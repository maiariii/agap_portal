import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { computeFit, nullifyPipelineIfDisqualified, cls, titleCase } from '@agap/shared';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Token verification middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ----------------- Auth Endpoints -----------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'locked' && user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ error: 'Account is locked. Please try again later.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      // Handle failed attempts lock out
      const attempts = user.failedLoginAttempts + 1;
      let updateData = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        updateData.status = 'locked';
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      }
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Verify Close Confirmation Passcode
app.post('/api/auth/verify-passcode', authenticateToken, async (req, res) => {
  const { passcode } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.passcodeHash) {
      return res.status(400).json({ error: 'No passcode configured for user' });
    }
    const isValid = await bcrypt.compare(passcode, user.passcodeHash);
    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid passcode' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------- Core Endpoints -----------------

// Helper to Hydrate Application RowData
async function getHydratedApplications(vacancyId = null) {
  const apps = await prisma.application.findMany({
    where: vacancyId ? { vacancyId } : {},
    include: {
      applicant: true,
      vacancy: {
        include: {
          position: true
        }
      },
      history: {
        orderBy: { at: 'desc' }
      },
      qualEvals: {
        orderBy: { at: 'desc' }
      }
    }
  });

  return apps.map(app => {
    const applicant = app.applicant;
    const vacancy = app.vacancy;
    const position = vacancy.position;
    
    // Parse JSON lists/objects stored as string for SQLite compatibility
    let parsedDocs = {};
    try { parsedDocs = JSON.parse(app.documents || '{}'); } catch(e){}

    let parsedChecklist = null;
    try { if (app.docChecklist) parsedChecklist = JSON.parse(app.docChecklist); } catch(e){}

    let parsedCompScores = null;
    try { if (app.comparativeAssessmentScores) parsedCompScores = JSON.parse(app.comparativeAssessmentScores); } catch(e){}

    const fitBase = computeFit(
      {
        bachelorDegree: applicant.bachelorDegree,
        major: applicant.major,
        yearsExperience: Number(applicant.yearsExperience),
        trainingHours: Number(applicant.trainingHours),
        eligibility: applicant.eligibility
      },
      {
        ...position,
        requiredDegreeKeywords: position.requiredDegreeKeywords.split(',')
      }
    );

    const latestEval = app.qualEvals[0] || null;
    let parsedAreaScores = {};
    if (latestEval && latestEval.areaScores) {
      try { parsedAreaScores = JSON.parse(latestEval.areaScores); } catch(e){}
    }

    const overallFit = latestEval && latestEval.overallFit !== null ? latestEval.overallFit : fitBase.overall;

    return {
      id: app.id,
      applicant: applicant.name,
      code: applicant.code,
      dateApplied: app.dateApplied.toISOString().slice(0,10),
      deadline: vacancy.postingEnd ? vacancy.postingEnd.toISOString().slice(0,10) : "",
      bachelorDegree: applicant.bachelorDegree,
      yearsExperience: Number(applicant.yearsExperience),
      trainingHours: Number(applicant.trainingHours),
      vacancy: vacancy.title,
      itemNo: vacancy.itemNo,
      location: vacancy.location || vacancy.school || "",
      school: vacancy.school || "",
      salaryGrade: vacancy.salaryGrade || "",
      qsDegree: position.requiredBachelorDegree || "No degree specified",
      qsExperience: `${position.minYearsExperience || 0} minimum year(s)`,
      qsTraining: `${position.minTrainingHours || 0} minimum hour(s)`,
      qsEligibility: position.eligibilityRequired || "Not specified",
      status: app.status,
      vacancyId: vacancy.id,
      fit: overallFit,
      applicantObj: applicant,
      vacancyObj: vacancy,
      positionObj: position,
      fitObj: {
        ...fitBase,
        overall: overallFit,
        manualScores: parsedAreaScores
      },
      latestEval: latestEval ? {
        ...latestEval,
        areaScores: parsedAreaScores
      } : null,
      appObj: {
        ...app,
        documents: parsedDocs,
        docChecklist: parsedChecklist,
        comparativeAssessmentScores: parsedCompScores
      }
    };
  });
}

// Get All Positions
app.get('/api/positions', authenticateToken, async (req, res) => {
  try {
    const list = await prisma.position.findMany();
    res.json(list.map(p => ({
      ...p,
      requiredDegreeKeywords: p.requiredDegreeKeywords.split(',')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Vacancies
app.get('/api/vacancies', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Automatically close open vacancies whose deadline has passed
    const expiredOpenVacancies = await prisma.vacancy.findMany({
      where: {
        status: 'open',
        postingEnd: {
          lt: today
        }
      }
    });

    if (expiredOpenVacancies.length > 0) {
      const expiredIds = expiredOpenVacancies.map(v => v.id);
      await prisma.vacancy.updateMany({
        where: {
          id: { in: expiredIds }
        },
        data: {
          status: 'closed'
        }
      });
    }

    const list = await prisma.vacancy.findMany({
      include: {
        position: true
      }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Vacancy
app.post('/api/vacancies', authenticateToken, async (req, res) => {
  const { positionId, itemNo, title, school, location, postingStart, postingEnd, salaryGrade } = req.body;
  try {
    const created = await prisma.vacancy.create({
      data: {
        positionId,
        itemNo,
        title,
        school,
        location,
        region: 'NCR',
        status: 'open',
        postingStart: postingStart ? new Date(postingStart) : null,
        postingEnd: postingEnd ? new Date(postingEnd) : null,
        salaryGrade: salaryGrade ? parseInt(salaryGrade) : null
      }
    });
    res.json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle Vacancy Status
app.put('/api/vacancies/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, postingStart, postingEnd } = req.body;
  try {
    const updated = await prisma.vacancy.update({
      where: { id },
      data: {
        status,
        postingStart: postingStart ? new Date(postingStart) : undefined,
        postingEnd: postingEnd ? new Date(postingEnd) : undefined
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Applications (fully hydrated)
app.get('/api/applications', authenticateToken, async (req, res) => {
  try {
    const list = await getHydratedApplications();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit/Save Evaluation Review
app.post('/api/applications/:id/review', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    result,
    docsComplete,
    docChecklist,
    remarks,
    overallFit,
    degreeScore,
    experienceScore,
    trainingScore,
    eligibilityScore,
    degreeDecision,
    experienceDecision,
    trainingDecision,
    eligibilityDecision,
    areaScores
  } = req.body;

  try {
    // 1. Create QualEval entry
    await prisma.qualEval.create({
      data: {
        applicationId: id,
        result,
        overallFit: parseFloat(overallFit) || null,
        degreeScore: parseFloat(degreeScore) || null,
        experienceScore: parseFloat(experienceScore) || null,
        trainingScore: parseFloat(trainingScore) || null,
        eligibilityScore: parseFloat(eligibilityScore) || null,
        degreeDecision,
        experienceDecision,
        trainingDecision,
        eligibilityDecision,
        documentaryComplete: docsComplete,
        remarks,
        areaScores: areaScores ? JSON.stringify(areaScores) : null
      }
    });

    // 2. Update Application status & checklist
    const appData = await prisma.application.findUnique({ where: { id } });
    let updatedApp = {
      status: result,
      documentaryComplete: docsComplete,
      docChecklist: docChecklist ? JSON.stringify(docChecklist) : null
    };

    if (remarks) {
      updatedApp.reason = remarks;
    }

    // Apply nullification rules if Disqualified
    if (result === 'disqualified') {
      updatedApp.assessmentStatus = null;
      updatedApp.comparativeAssessmentScores = null;
      updatedApp.appointmentStatus = null;
      updatedApp.appointmentDate = null;
      updatedApp.appointmentItemNo = null;
      updatedApp.appointmentReferenceCode = null;
    }

    await prisma.application.update({
      where: { id },
      data: updatedApp
    });

    // 3. Add to application history
    await prisma.applicationHistory.create({
      data: {
        applicationId: id,
        text: `Saved documentary requirements / QS evaluation status as ${result}`
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post IER (Move qualified to for_comparative_assessment)
app.post('/api/applications/post-ier', authenticateToken, async (req, res) => {
  const { vacancyId } = req.body;
  try {
    const apps = await prisma.application.findMany({
      where: { vacancyId, status: 'qualified' }
    });

    for (const app of apps) {
      await prisma.application.update({
        where: { id: app.id },
        data: {
          status: 'for_comparative_assessment'
        }
      });

      await prisma.applicationHistory.create({
        data: {
          applicationId: app.id,
          text: 'IER posted; moved to comparative assessment'
        }
      });
    }

    res.json({ success: true, count: apps.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Pipeline Stage / Stage edit (Comparative Assessment, etc.)
app.put('/api/applications/:id/pipeline', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { assessmentStatus, comparativeAssessmentScores, status } = req.body;
  try {
    await prisma.application.update({
      where: { id },
      data: {
        status: status || undefined,
        assessmentStatus: assessmentStatus || undefined,
        comparativeAssessmentScores: comparativeAssessmentScores ? JSON.stringify(comparativeAssessmentScores) : undefined
      }
    });
    
    await prisma.applicationHistory.create({
      data: {
        applicationId: id,
        text: `Pipeline stage updated. Status: ${status || 'unchanged'}, Assessment: ${assessmentStatus || 'unchanged'}`
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm Appointment & Reject others
app.post('/api/applications/:id/appointment', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { appointmentDate, appointmentReferenceCode } = req.body;
  try {
    const currentApp = await prisma.application.findUnique({
      where: { id },
      include: { vacancy: true }
    });

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Update appointed applicant
    await prisma.application.update({
      where: { id },
      data: {
        appointmentStatus: 'appointed',
        appointmentDate: new Date(appointmentDate),
        appointmentItemNo: currentApp.vacancy.itemNo,
        appointmentReferenceCode
      }
    });

    await prisma.applicationHistory.create({
      data: {
        applicationId: id,
        text: `Appointed to item ${currentApp.vacancy.itemNo}. Reference: ${appointmentReferenceCode}`
      }
    });

    // Automatically reject other applicants for the same vacancy item
    const otherApps = await prisma.application.findMany({
      where: {
        vacancyId: currentApp.vacancyId,
        id: { not: id },
        status: { not: 'disqualified' }
      }
    });

    for (const otherApp of otherApps) {
      await prisma.application.update({
        where: { id: otherApp.id },
        data: {
          appointmentStatus: 'rejected',
          reason: `Item ${currentApp.vacancy.itemNo} filled by another applicant`
        }
      });
      await prisma.applicationHistory.create({
        data: {
          applicationId: otherApp.id,
          text: `Rejected: Item ${currentApp.vacancy.itemNo} filled by another applicant`
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import simulated NOSCA
app.post('/api/vacancies/import-nosca', authenticateToken, async (req, res) => {
  const { items } = req.body; // array of { itemNo, title, positionId }
  try {
    const createdList = [];
    for (const item of items) {
      const created = await prisma.vacancy.create({
        data: {
          positionId: item.positionId,
          itemNo: item.itemNo,
          title: item.title,
          school: '',
          location: 'SDO Manila',
          region: 'NCR',
          status: 'closed' // Default closed per spec
        }
      });
      createdList.push(created);
    }
    res.json(createdList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

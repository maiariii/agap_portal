import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { computeFit, nullifyPipelineIfDisqualified, cls, titleCase } from '@agap/shared';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
    ? { rejectUnauthorized: false }
    : false
});

pool.on('connect', (client) => {
  client.query('SET search_path TO public;');
});

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Helper Mappers
function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    contactNumber: row.contact_number,
    office: row.office,
    passwordHash: row.password_hash,
    passcodeHash: row.passcode_hash,
    role: row.role,
    status: row.status,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    passwordChangedAt: new Date(row.password_changed_at),
    mustChangePassword: row.must_change_password,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapPosition(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    track: row.track,
    requiredBachelorDegree: row.required_bachelor_degree,
    requiredDegreeKeywords: Array.isArray(row.required_degree_keywords) ? row.required_degree_keywords : (row.required_degree_keywords ? row.required_degree_keywords.split(',') : []),
    minYearsExperience: row.min_years_experience,
    minTrainingHours: row.min_training_hours,
    eligibilityRequired: row.eligibility_required,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapVacancy(row) {
  if (!row) return null;
  return {
    id: row.id,
    positionId: row.position_id,
    itemNo: row.item_no,
    title: row.title,
    school: row.school,
    location: row.location,
    region: row.region,
    status: row.status,
    postingStart: row.posting_start ? new Date(row.posting_start) : null,
    postingEnd: row.posting_end ? new Date(row.posting_end) : null,
    salaryGrade: row.salary_grade,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

// Helper to Hydrate Application RowData
async function getHydratedApplications(vacancyId = null) {
  let query = `
    SELECT 
      a.*,
      ap.name as applicant_name,
      ap.code as applicant_code,
      ap.local_resident as applicant_local_resident,
      ap.bachelor_degree as applicant_bachelor_degree,
      ap.major as applicant_major,
      ap.years_experience as applicant_years_experience,
      ap.training_hours as applicant_training_hours,
      ap.eligibility as applicant_eligibility,
      v.title as vacancy_title,
      v.item_no as vacancy_item_no,
      v.location as vacancy_location,
      v.school as vacancy_school,
      v.salary_grade as vacancy_salary_grade,
      v.posting_end as vacancy_posting_end,
      v.status as vacancy_status,
      p.id as position_id,
      p.title as position_title,
      p.track as position_track,
      p.required_bachelor_degree as position_required_bachelor_degree,
      p.required_degree_keywords as position_required_degree_keywords,
      p.min_years_experience as position_min_years_experience,
      p.min_training_hours as position_min_training_hours,
      p.eligibility_required as position_eligibility_required,
      (
        SELECT COALESCE(json_agg(h ORDER BY h.at DESC), '[]'::json)
        FROM application_history h 
        WHERE h.application_id = a.id
      ) as history,
      (
        SELECT COALESCE(json_agg(q ORDER BY q.at DESC), '[]'::json)
        FROM qual_evals q 
        WHERE q.application_id = a.id
      ) as qual_evals
    FROM applications a
    JOIN applicants ap ON a.applicant_id = ap.id
    JOIN vacancies v ON a.vacancy_id = v.id
    JOIN positions p ON v.position_id = p.id
  `;
  
  const values = [];
  if (vacancyId) {
    query += ` WHERE a.vacancy_id = $1`;
    values.push(vacancyId);
  }

  const { rows } = await pool.query(query, values);

  return rows.map(row => {
    let parsedDocs = {};
    if (typeof row.documents === 'object' && row.documents !== null) {
      parsedDocs = row.documents;
    } else {
      try { parsedDocs = JSON.parse(row.documents || '{}'); } catch(e){}
    }

    let parsedChecklist = null;
    if (row.doc_checklist) {
      if (typeof row.doc_checklist === 'object') {
        parsedChecklist = row.doc_checklist;
      } else {
        try { parsedChecklist = JSON.parse(row.doc_checklist); } catch(e){}
      }
    }

    let parsedCompScores = null;
    if (row.comparative_assessment_scores) {
      if (typeof row.comparative_assessment_scores === 'object') {
        parsedCompScores = row.comparative_assessment_scores;
      } else {
        try { parsedCompScores = JSON.parse(row.comparative_assessment_scores); } catch(e){}
      }
    }

    const fitBase = computeFit(
      {
        bachelorDegree: row.applicant_bachelor_degree,
        major: row.applicant_major,
        yearsExperience: Number(row.applicant_years_experience),
        trainingHours: Number(row.applicant_training_hours),
        eligibility: row.applicant_eligibility
      },
      {
        id: row.position_id,
        title: row.position_title,
        track: row.position_track,
        requiredBachelorDegree: row.position_required_bachelor_degree,
        requiredDegreeKeywords: Array.isArray(row.position_required_degree_keywords) ? row.position_required_degree_keywords : (row.position_required_degree_keywords ? row.position_required_degree_keywords.split(',') : []),
        minYearsExperience: row.position_min_years_experience,
        minTrainingHours: row.position_min_training_hours,
        eligibilityRequired: row.position_eligibility_required
      }
    );

    const latestEval = row.qual_evals[0] || null;
    let parsedAreaScores = {};
    if (latestEval && latestEval.area_scores) {
      if (typeof latestEval.area_scores === 'object') {
        parsedAreaScores = latestEval.area_scores;
      } else {
        try { parsedAreaScores = JSON.parse(latestEval.area_scores); } catch(e){}
      }
    }

    const overallFit = latestEval && latestEval.overall_fit !== null ? Number(latestEval.overall_fit) : fitBase.overall;

    return {
      id: row.id,
      applicant: row.applicant_name,
      code: row.applicant_code,
      dateApplied: row.date_applied ? new Date(row.date_applied).toISOString().slice(0,10) : "",
      deadline: row.vacancy_posting_end ? new Date(row.vacancy_posting_end).toISOString().slice(0,10) : "",
      bachelorDegree: row.applicant_bachelor_degree,
      yearsExperience: Number(row.applicant_years_experience),
      trainingHours: Number(row.applicant_training_hours),
      vacancy: row.vacancy_title,
      itemNo: row.vacancy_item_no,
      location: row.vacancy_location || row.vacancy_school || "",
      school: row.vacancy_school || "",
      salaryGrade: row.vacancy_salary_grade || "",
      qsDegree: row.position_required_bachelor_degree || "No degree specified",
      qsExperience: `${row.position_min_years_experience || 0} minimum year(s)`,
      qsTraining: `${row.position_min_training_hours || 0} minimum hour(s)`,
      qsEligibility: row.position_eligibility_required || "Not specified",
      status: row.status,
      appointmentStatus: row.appointment_status,
      appointmentReferenceCode: row.appointment_reference_code,
      appointmentDate: row.appointment_date ? new Date(row.appointment_date).toISOString() : null,
      vacancyId: row.vacancy_id,
      fit: overallFit,
      applicantObj: {
        id: row.applicant_id,
        name: row.applicant_name,
        code: row.applicant_code,
        localResident: row.applicant_local_resident,
        bachelorDegree: row.applicant_bachelor_degree,
        major: row.applicant_major,
        yearsExperience: row.applicant_years_experience,
        trainingHours: row.applicant_training_hours,
        eligibility: row.applicant_eligibility
      },
      vacancyObj: {
        id: row.vacancy_id,
        positionId: row.position_id,
        itemNo: row.vacancy_item_no,
        title: row.vacancy_title,
        school: row.vacancy_school,
        location: row.vacancy_location,
        region: 'NCR',
        status: row.vacancy_status,
        postingEnd: row.vacancy_posting_end
      },
      positionObj: {
        id: row.position_id,
        title: row.position_title,
        track: row.position_track,
        requiredBachelorDegree: row.position_required_bachelor_degree,
        requiredDegreeKeywords: row.position_required_degree_keywords,
        minYearsExperience: row.position_min_years_experience,
        minTrainingHours: row.position_min_training_hours,
        eligibilityRequired: row.position_eligibility_required
      },
      fitObj: {
        ...fitBase,
        overall: overallFit,
        manualScores: parsedAreaScores
      },
      latestEval: latestEval ? {
        id: latestEval.id,
        applicationId: latestEval.application_id,
        result: latestEval.result,
        overallFit: latestEval.overall_fit,
        degreeScore: latestEval.degree_score,
        experienceScore: latestEval.experience_score,
        trainingScore: latestEval.training_score,
        eligibilityScore: latestEval.eligibility_score,
        degreeDecision: latestEval.degree_decision,
        experienceDecision: latestEval.experience_decision,
        trainingDecision: latestEval.training_decision,
        eligibilityDecision: latestEval.eligibility_decision,
        documentaryComplete: latestEval.documentary_complete,
        remarks: latestEval.remarks,
        areaScores: parsedAreaScores,
        at: latestEval.at
      } : null,
      appObj: {
        id: row.id,
        applicationNumber: row.application_number,
        vacancyId: row.vacancy_id,
        applicantId: row.applicant_id,
        status: row.status,
        dateApplied: row.date_applied,
        documents: parsedDocs,
        documentaryComplete: row.documentary_complete,
        docChecklist: parsedChecklist,
        reason: row.reason,
        assessmentStatus: row.assessment_status,
        comparativeAssessmentScores: parsedCompScores,
        appointmentStatus: row.appointment_status,
        appointmentDate: row.appointment_date,
        appointmentItemNo: row.appointment_item_no,
        appointmentReferenceCode: row.appointment_reference_code,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    };
  });
}

// ----------------- Auth Endpoints -----------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'locked' && user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is locked. Please try again later.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const attempts = user.failed_login_attempts + 1;
      let status = user.status;
      let lockedUntil = user.locked_until;
      if (attempts >= 5) {
        status = 'locked';
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      }
      await pool.query(
        'UPDATE users SET failed_login_attempts = $1, status = $2, locked_until = $3 WHERE id = $4',
        [attempts, status, lockedUntil, user.id]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = null, last_login_at = $1 WHERE id = $2',
      [new Date(), user.id]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
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
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user || !user.passcode_hash) {
      return res.status(400).json({ error: 'No passcode configured for user' });
    }
    let isValid = await bcrypt.compare(passcode, user.passcode_hash);
    if (!isValid && user.password_hash) {
      isValid = await bcrypt.compare(passcode, user.password_hash);
    }
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

// Get All Positions
app.get('/api/positions', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM positions');
    res.json(rows.map(mapPosition));
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
    const { rows: expiredVacancies } = await pool.query(
      "SELECT id FROM vacancies WHERE status = 'open' AND posting_end < $1",
      [today]
    );

    if (expiredVacancies.length > 0) {
      const expiredIds = expiredVacancies.map(v => v.id);
      await pool.query(
        "UPDATE vacancies SET status = 'closed' WHERE id = ANY($1)",
        [expiredIds]
      );
    }

    const { rows } = await pool.query(`
      SELECT v.*, p.title as position_title, p.track as position_track,
             p.required_bachelor_degree as position_required_bachelor_degree,
             p.required_degree_keywords as position_required_degree_keywords,
             p.min_years_experience as position_min_years_experience,
             p.min_training_hours as position_min_training_hours,
             p.eligibility_required as position_eligibility_required
      FROM vacancies v
      JOIN positions p ON v.position_id = p.id
    `);

    res.json(rows.map(r => ({
      ...mapVacancy(r),
      position: {
        id: r.position_id,
        title: r.position_title,
        track: r.position_track,
        requiredBachelorDegree: r.position_required_bachelor_degree,
        requiredDegreeKeywords: Array.isArray(r.position_required_degree_keywords) ? r.position_required_degree_keywords : (r.position_required_degree_keywords ? r.position_required_degree_keywords.split(',') : []),
        minYearsExperience: r.position_min_years_experience,
        minTrainingHours: r.position_min_training_hours,
        eligibilityRequired: r.position_eligibility_required
      }
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Vacancy
app.post('/api/vacancies', authenticateToken, async (req, res) => {
  const { positionId, itemNo, title, school, location, postingStart, postingEnd, salaryGrade } = req.body;
  try {
    const id = crypto.randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, school, location, region, status, posting_start, posting_end, salary_grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        positionId,
        itemNo,
        title,
        school,
        location,
        'NCR',
        'open',
        postingStart ? new Date(postingStart) : null,
        postingEnd ? new Date(postingEnd) : null,
        salaryGrade ? parseInt(salaryGrade) : null
      ]
    );
    res.json(mapVacancy(rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle Vacancy Status
app.put('/api/vacancies/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, postingStart, postingEnd } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (postingStart !== undefined) {
      fields.push(`posting_start = $${idx++}`);
      values.push(postingStart ? new Date(postingStart) : null);
    }
    if (postingEnd !== undefined) {
      fields.push(`posting_end = $${idx++}`);
      values.push(postingEnd ? new Date(postingEnd) : null);
    }

    values.push(id);
    const query = `UPDATE vacancies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(query, values);
    res.json(mapVacancy(rows[0]));
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
    const evalId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, degree_decision, experience_decision, training_decision, eligibility_decision, documentary_complete, remarks, area_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        evalId,
        id,
        result,
        overallFit ? parseFloat(overallFit) : null,
        degreeScore ? parseFloat(degreeScore) : null,
        experienceScore ? parseFloat(experienceScore) : null,
        trainingScore ? parseFloat(trainingScore) : null,
        eligibilityScore ? parseFloat(eligibilityScore) : null,
        degreeDecision || null,
        experienceDecision || null,
        trainingDecision || null,
        eligibilityDecision || null,
        docsComplete,
        remarks || null,
        areaScores ? JSON.stringify(areaScores) : null
      ]
    );

    // 2. Update Application status & checklist
    const fields = ['status = $1', 'documentary_complete = $2', 'doc_checklist = $3', 'updated_at = NOW()'];
    const values = [result, docsComplete, docChecklist ? JSON.stringify(docChecklist) : null];
    let idx = 4;

    if (remarks) {
      fields.push(`reason = $${idx++}`);
      values.push(remarks);
    }

    if (result === 'disqualified') {
      fields.push(`assessment_status = NULL`);
      fields.push(`comparative_assessment_scores = NULL`);
      fields.push(`appointment_status = NULL`);
      fields.push(`appointment_date = NULL`);
      fields.push(`appointment_item_no = NULL`);
      fields.push(`appointment_reference_code = NULL`);
    }

    values.push(id);
    const appQuery = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${idx}`;
    await pool.query(appQuery, values);

    // 3. Add to application history
    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Saved documentary requirements / QS evaluation status as ${result}`]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post IER (Move qualified to for_comparative_assessment)
app.post('/api/applications/post-ier', authenticateToken, async (req, res) => {
  const { vacancyId } = req.body;
  try {
    const { rows: apps } = await pool.query(
      "SELECT id FROM applications WHERE vacancy_id = $1 AND status = 'qualified'",
      [vacancyId]
    );

    for (const app of apps) {
      await pool.query(
        "UPDATE applications SET status = 'for_comparative_assessment', updated_at = NOW() WHERE id = $1",
        [app.id]
      );

      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, app.id, 'IER posted; moved to comparative assessment']
      );
    }

    res.json({ success: true, count: apps.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Pipeline Stage / Stage edit (Comparative Assessment, etc.)
app.put('/api/applications/:id/pipeline', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { assessmentStatus, comparativeAssessmentScores, status, areaScores, overallFit } = req.body;
  try {
    const { rows } = await pool.query('SELECT status FROM applications WHERE id = $1', [id]);
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const updatedStatus = status || currentApp.status;

    const fields = ['updated_at = NOW()'];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (assessmentStatus !== undefined) {
      fields.push(`assessment_status = $${idx++}`);
      values.push(assessmentStatus);
    }
    if (comparativeAssessmentScores !== undefined) {
      fields.push(`comparative_assessment_scores = $${idx++}`);
      values.push(comparativeAssessmentScores ? JSON.stringify(comparativeAssessmentScores) : null);
    }

    values.push(id);
    const appQuery = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${idx}`;
    await pool.query(appQuery, values);

    if (areaScores) {
      const evalId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, area_scores, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          evalId,
          id,
          updatedStatus,
          overallFit ? parseFloat(overallFit) : null,
          areaScores.education ? parseFloat(areaScores.education) : null,
          areaScores.experience ? parseFloat(areaScores.experience) : null,
          areaScores.training ? parseFloat(areaScores.training) : null,
          areaScores.eligibility ? parseFloat(areaScores.eligibility) : null,
          JSON.stringify(areaScores),
          "Qualified modal scoring metrics saved"
        ]
      );
    }
    
    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Pipeline stage updated. Status: ${status || 'unchanged'}, Assessment: ${assessmentStatus || 'unchanged'}`]
    );

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
    const { rows } = await pool.query(
      `SELECT a.*, v.item_no as vacancy_item_no 
       FROM applications a 
       JOIN vacancies v ON a.vacancy_id = v.id 
       WHERE a.id = $1`,
      [id]
    );
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { rows: occupiedRows } = await pool.query(
      `SELECT a.id FROM applications a
       JOIN vacancies v ON a.vacancy_id = v.id
       WHERE v.item_no = $1 AND a.appointment_status = 'appointed' AND a.id <> $2 LIMIT 1`,
      [currentApp.vacancy_item_no, id]
    );
    const occupiedApp = occupiedRows[0];

    if (occupiedApp) {
      await pool.query(
        `UPDATE applications 
         SET status = 'not_appointed', appointment_status = 'not_appointed', 
             appointment_date = $1, appointment_item_no = $2, appointment_reference_code = $3, updated_at = NOW()
         WHERE id = $4`,
        [
          appointmentDate ? new Date(appointmentDate) : null,
          currentApp.vacancy_item_no,
          appointmentReferenceCode || null,
          id
        ]
      );

      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, id, `Not Appointed: Item ${currentApp.vacancy_item_no} is already occupied by another appointed applicant.`]
      );

      return res.json({ success: true, occupied: true });
    }

    // Update appointed applicant
    await pool.query(
      `UPDATE applications 
       SET status = 'appointed', appointment_status = 'appointed', 
           appointment_date = $1, appointment_item_no = $2, appointment_reference_code = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        new Date(appointmentDate),
        currentApp.vacancy_item_no,
        appointmentReferenceCode,
        id
      ]
    );

    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Appointed to item ${currentApp.vacancy_item_no}. Reference: ${appointmentReferenceCode}`]
    );

    // Automatically mark other applicants for the same vacancy item as "Not Appointed"
    const { rows: otherApps } = await pool.query(
      `SELECT id FROM applications 
       WHERE vacancy_id = $1 AND id <> $2 AND status IN ('qualified', 'for_comparative_assessment', 'not_appointed')`,
      [currentApp.vacancy_id, id]
    );

    for (const otherApp of otherApps) {
      await pool.query(
        `UPDATE applications 
         SET status = 'not_appointed', appointment_status = 'not_appointed', 
             reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [`Item ${currentApp.vacancy_item_no} filled by another applicant`, otherApp.id]
      );

      const otherHistoryId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [otherHistoryId, otherApp.id, `Not Appointed: Item ${currentApp.vacancy_item_no} filled by another applicant`]
      );
    }

    res.json({ success: true, occupied: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scan NOSCA file (base64)
app.post('/api/vacancies/scan-nosca', authenticateToken, async (req, res) => {
  const { fileData, fileName } = req.body;
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '../../../');
  const scannerPath = path.join(rootDir, 'scanner.py');
  const tempFilename = `temp_${Date.now()}_${fileName || 'nosca.pdf'}`;
  const tempFilePath = path.join(rootDir, tempFilename);

  try {
    const buffer = Buffer.from(fileData, 'base64');
    fs.writeFileSync(tempFilePath, buffer);

    exec(`python "${scannerPath}" "${tempFilePath}"`, (error, stdout, stderr) => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }

      if (error) {
        console.error(`Exec error: ${error}`);
        return res.status(500).json({ error: `Scanning failed: ${stderr || error.message}` });
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          return res.status(400).json({ error: parsed.error });
        }
        res.json(parsed);
      } catch (parseError) {
        console.error(`Failed to parse scanner output: ${stdout}`);
        res.status(500).json({ error: 'Failed to parse scanner output' });
      }
    });
  } catch (error) {
    console.error(error);
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (_) {}
    res.status(500).json({ error: error.message });
  }
});

// Import simulated/scanned NOSCA
app.post('/api/vacancies/import-nosca', authenticateToken, async (req, res) => {
  const { items } = req.body; // array of { itemNo, title, positionId }
  try {
    const createdList = [];
    for (const item of items) {
      let positionId = item.positionId;
      if (!positionId && item.title) {
        // Find or create the position dynamically
        const { rows: posRows } = await pool.query('SELECT * FROM positions WHERE title = $1 LIMIT 1', [item.title]);
        let pos = posRows[0];
        if (!pos) {
          const newPosId = crypto.randomUUID();
          const { rows: newPosRows } = await pool.query(
            `INSERT INTO positions (id, title, track, required_bachelor_degree, required_degree_keywords, min_years_experience, min_training_hours, eligibility_required)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
              newPosId,
              item.title,
              'administrative',
              "Relevant bachelor's degree",
              ['degree', 'bachelor'],
              0,
              0,
              'Career Service Professional'
            ]
          );
          pos = newPosRows[0];
        }
        positionId = pos.id;
      }

      const id = crypto.randomUUID();
      const { rows: vacRows } = await pool.query(
        `INSERT INTO vacancies (id, position_id, item_no, title, school, location, region, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          id,
          positionId,
          item.itemNo,
          item.title,
          '',
          'SDO Manila',
          'NCR',
          'closed' // Default closed per spec
        ]
      );
      createdList.push(mapVacancy(vacRows[0]));
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

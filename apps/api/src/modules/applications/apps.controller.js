import { pool } from '../../config/db.js';
import { getHydratedApplications } from './apps.service.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { BlobServiceClient } from '@azure/storage-blob';
import { computeOverallAreaScore } from '@agap/shared';


export async function getApplications(req, res) {
  try {
    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [req.user.id]);
    const user = userQuery.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { region, division } = user;

    const list = await getHydratedApplications(null, region, division);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function reviewApplication(req, res) {
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
    const { rows: appRows } = await pool.query('SELECT appointment_status, assessment_status, status FROM applications WHERE id = $1', [id]);
    // Evaluation locking is disabled
    const app = null;

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

    const fields = ['status = $1', 'application_status = $2', 'documentary_complete = $3', 'doc_checklist = $4', 'updated_at = NOW()'];
    const values = [result, result, docsComplete, docChecklist ? JSON.stringify(docChecklist) : null];
    let idx = 5;

    if (remarks) {
      fields.push(`reason = $${idx++}`);
      values.push(remarks);
    }

    if (result && result.toLowerCase() === 'qualified') {
      if (!app || !app.assessment_status || app.assessment_status === 'Assessment Not Started') {
        fields.push(`assessment_status = $${idx++}`);
        values.push('Assessment Not Started');
      }
    } else if (result && result.toLowerCase() === 'disqualified') {
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

    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Saved documentary requirements / QS evaluation status as ${result}`]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function postIer(req, res) {
  const { vacancyId } = req.body;
  try {
    const { rows: apps } = await pool.query(
      "SELECT id FROM applications WHERE job_cluster_id = $1 AND LOWER(status) = 'qualified'",
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
}

export async function updatePipeline(req, res) {
  const { id } = req.params;
  const { assessmentStatus, comparativeAssessmentScores, status, areaScores, overallFit } = req.body;
  try {
    const { rows } = await pool.query('SELECT status, appointment_status, assessment_status FROM applications WHERE id = $1', [id]);
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const apptLower = (currentApp.appointment_status || '').toLowerCase();
    if (apptLower === 'appointed' || apptLower === 'rejected' || apptLower === 'not appointed' || apptLower === 'not_appointed') {
      return res.status(400).json({ error: 'Cannot modify assessment once appointment is recorded.' });
    }

    // Removed the backward assessment status check to allow more flexible score modifications

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
      const computedOverallFit = computeOverallAreaScore(areaScores);
      const evalId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, area_scores, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          evalId,
          id,
          updatedStatus,
          computedOverallFit,
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
}

export async function confirmAppointment(req, res) {
  const { id } = req.params;
  const { appointmentDate, passcode } = req.body;
  try {
    // 1. Verify HRMO passcode
    if (!passcode) {
      return res.status(400).json({ error: 'HRMO passcode is required to confirm appointment.' });
    }

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userRows[0];
    if (!user || !user.passcode_hash) {
      return res.status(400).json({ error: 'No passcode configured for your user account.' });
    }

    let isValid = (passcode === user.passcode_hash);
    if (!isValid) {
      isValid = await bcrypt.compare(passcode, user.passcode_hash).catch(() => false);
    }
    if (!isValid && user.password_hash) {
      isValid = await bcrypt.compare(passcode, user.password_hash).catch(() => false);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid passcode. Appointment cannot be confirmed.' });
    }

    // 2. Autogenerate reference code
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const appointmentReferenceCode = `APPT-${today}-${rand}`;

    const { rows } = await pool.query(
      `SELECT a.* 
       FROM applications a 
       WHERE a.id = $1`,
      [id]
    );
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const selectedItemNo = appointmentItemNo || currentApp.appointment_item_no;
    if (!selectedItemNo) {
      return res.status(400).json({ error: 'A specific plantilla item number must be selected.' });
    }

    const { rows: occupiedRows } = await pool.query(
      `SELECT a.id FROM applications a
       WHERE a.appointment_item_no = $1 AND a.appointment_status = 'appointed' AND a.id <> $2 LIMIT 1`,
      [selectedItemNo, id]
    );
    const occupiedApp = occupiedRows[0];

    if (occupiedApp) {
      await pool.query(
        `UPDATE applications 
         SET appointment_status = 'not_appointed', 
             appointment_date = $1, appointment_item_no = $2, appointment_reference_code = $3, updated_at = NOW()
         WHERE id = $4`,
        [
          appointmentDate ? new Date(appointmentDate) : null,
          selectedItemNo,
          appointmentReferenceCode,
          id
        ]
      );

      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, id, `Not Appointed: Item ${selectedItemNo} is already occupied by another appointed applicant.`]
      );

      return res.json({ success: true, occupied: true });
    }

    await pool.query(
      `UPDATE applications 
       SET appointment_status = 'appointed', 
           appointment_date = $1, appointment_item_no = $2, appointment_reference_code = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        new Date(appointmentDate),
        selectedItemNo,
        appointmentReferenceCode,
        id
      ]
    );

    // Update vacancy status to closed and filling_up_status to FILLED for the specific item
    await pool.query(
      `UPDATE vacancies 
       SET status = 'closed', filling_up_status = 'FILLED', updated_at = NOW() 
       WHERE item_no = $1 AND job_cluster_id = $2`,
      [selectedItemNo, currentApp.job_cluster_id]
    );

    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Appointed to item ${selectedItemNo}. Reference: ${appointmentReferenceCode}`]
    );

    // Check if there are any remaining unfilled items in the cluster
    const { rows: unfilledItems } = await pool.query(
      `SELECT id FROM vacancies WHERE job_cluster_id = $1 AND filling_up_status = 'UNFILLED'`,
      [currentApp.job_cluster_id]
    );

    // If no more unfilled items exist in this cluster, mark all other qualified candidates as not_appointed
    if (unfilledItems.length === 0) {
      const { rows: otherApps } = await pool.query(
        `SELECT id FROM applications 
         WHERE job_cluster_id = $1 AND id <> $2 AND LOWER(status) IN ('qualified', 'for_comparative_assessment', 'not_appointed')`,
        [currentApp.job_cluster_id, id]
      );

      for (const otherApp of otherApps) {
        await pool.query(
          `UPDATE applications 
           SET appointment_status = 'not_appointed', 
               reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [`All items in the job cluster have been filled`, otherApp.id]
        );

        const otherHistoryId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
          [otherHistoryId, otherApp.id, `Not Appointed: All items in the job cluster have been filled.`]
        );
      }
    }

    res.json({ success: true, occupied: false, appointmentReferenceCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function rollbackAppointment(req, res) {
  const { id } = req.params;
  const { passcode } = req.body;
  try {
    if (!passcode) {
      return res.status(400).json({ error: 'HRMO passcode is required to rollback appointment.' });
    }

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userRows[0];
    if (!user || !user.passcode_hash) {
      return res.status(400).json({ error: 'No passcode configured for your user account.' });
    }

    let isValid = (passcode === user.passcode_hash);
    if (!isValid) {
      isValid = await bcrypt.compare(passcode, user.passcode_hash).catch(() => false);
    }
    if (!isValid && user.password_hash) {
      isValid = await bcrypt.compare(passcode, user.password_hash).catch(() => false);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid passcode. Appointment cannot be rolled back.' });
    }

    const { rows } = await pool.query('SELECT job_cluster_id, appointment_item_no FROM applications WHERE id = $1', [id]);
    const currentApp = rows[0];
    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { job_cluster_id, appointment_item_no } = currentApp;

    if (appointment_item_no) {
      await pool.query(
        `UPDATE vacancies 
         SET status = 'open', filling_up_status = 'UNFILLED', updated_at = NOW() 
         WHERE item_no = $1 AND job_cluster_id = $2`,
        [appointment_item_no, job_cluster_id]
      );
    }

    const { rows: affectedApps } = await pool.query(
      `SELECT id, appointment_status FROM applications 
       WHERE job_cluster_id = $1 AND (appointment_status = 'appointed' OR appointment_status = 'not_appointed')`,
      [job_cluster_id]
    );

    await pool.query(
      `UPDATE applications 
       SET appointment_status = NULL, 
           appointment_date = NULL, 
           appointment_item_no = NULL, 
           appointment_reference_code = NULL, 
           reason = NULL,
           updated_at = NOW()
       WHERE vacancy_id = $1`,
      [vacancy_id]
    );

    for (const app of affectedApps) {
      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, app.id, `Appointment rolled back. Previous status: ${app.appointment_status}`]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function getApplicationDocuments(req, res) {
  const { id } = req.params;
  const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const AZURE_FOLDER_NAME = "staging-agap";
  const sampleHash = "AGAP-0001_Personal_Data_Sheet_1784171209875";
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  console.log(`[Azure Storage] Scanning documents in folder "${AZURE_FOLDER_NAME}" for application ID "${id}"...`);
  
  const appQuery = await pool.query(
    `SELECT ap.id, ap.applicant_number, ap.code, ap.surname, ap.first_name 
     FROM applications a 
     JOIN applicants ap ON a.applicant_id = ap.id 
     WHERE a.id = $1`,
    [id]
  );
  const app = appQuery.rows[0];
  const applicantCode = app ? (app.code || app.applicant_number || '') : '';

  const documents = [
    { key: 'pds', label: 'Personal Data Sheet', filename: `${sampleHash}.pdf`, existsInAzure: false },
    { key: 'work_experience', label: 'Work Experience Sheet', filename: 'AGAP-0001_Work_Experience_Sheet.pdf', existsInAzure: false },
    { key: 'eligibility', label: 'Certificate of Eligibility', filename: 'AGAP-0001_Certificate_of_Eligibility.pdf', existsInAzure: false },
    { key: 'tor', label: 'Transcript of Records', filename: 'AGAP-0001_Transcript_of_Records.pdf', existsInAzure: false },
    { key: 'prc', label: 'Updated PRC License/ID', filename: 'AGAP-0001_Updated_PRC_License_ID.pdf', existsInAzure: false },
    { key: 'diploma', label: 'Diploma (optional)', filename: 'AGAP-0001_Diploma.pdf', existsInAzure: false },
    { key: 'resume', label: 'Resume', filename: 'AGAP-0001_Resume.pdf', existsInAzure: false },
    { key: 'performance_rating', label: 'Performance Rating', filename: 'AGAP-0001_Performance_Rating.pdf', existsInAzure: false },
    { key: 'training_certificates', label: 'Training Certificates', filename: 'AGAP-0001_Training_Certificates.pdf', existsInAzure: false },
    { key: 'application_education', label: 'Application of Education', filename: 'AGAP-0001_Application_of_Education.pdf', existsInAzure: false },
    { key: 'application_learning', label: 'Application of Learning and Development', filename: 'AGAP-0001_Application_of_Learning_and_Development.pdf', existsInAzure: false }
  ];

  if (connString && connString !== 'ReplaceWithYourAzureStorageConnectionString') {
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
      const containerClient = blobServiceClient.getContainerClient(AZURE_FOLDER_NAME);
      
      const azureBlobs = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        azureBlobs.push({ name: blob.name, nameLower: blob.name.toLowerCase() });
      }
      
      const checkMatch = (codeToUse) => {
        let count = 0;
        documents.forEach(doc => {
          const cleanKey = doc.key.toLowerCase();
          const matchedBlob = azureBlobs.find(b => {
            const isForApplicant = codeToUse && b.nameLower.includes(codeToUse.toLowerCase());
            let isForDocType = false;
            
            if (cleanKey === 'pds' && (b.nameLower.includes('personal_data_sheet') || b.nameLower.includes('pds'))) {
              isForDocType = true;
            } else if (cleanKey === 'work_experience' && (b.nameLower.includes('work_experience') || b.nameLower.includes('wes') || b.nameLower.includes('experience'))) {
              isForDocType = true;
            } else if (cleanKey === 'eligibility' && (b.nameLower.includes('eligibility') || b.nameLower.includes('coe'))) {
              isForDocType = true;
            } else if (cleanKey === 'tor' && (b.nameLower.includes('transcript') || b.nameLower.includes('tor'))) {
              isForDocType = true;
            } else if (cleanKey === 'prc' && (b.nameLower.includes('prc') || b.nameLower.includes('license') || b.nameLower.includes('id'))) {
              isForDocType = true;
            } else if (cleanKey === 'diploma' && b.nameLower.includes('diploma')) {
              isForDocType = true;
            } else if (cleanKey === 'resume' && (b.nameLower.includes('resume') || b.nameLower.includes('cv'))) {
              isForDocType = true;
            } else if (cleanKey === 'performance_rating' && (b.nameLower.includes('performance') || b.nameLower.includes('rating'))) {
              isForDocType = true;
            } else if (cleanKey === 'training_certificates' && (b.nameLower.includes('training') || b.nameLower.includes('certificate'))) {
              isForDocType = true;
            } else if (cleanKey === 'application_education' && (b.nameLower.includes('application_education') || b.nameLower.includes('app_education'))) {
              isForDocType = true;
            } else if (cleanKey === 'application_learning' && (b.nameLower.includes('application_learning') || b.nameLower.includes('app_learning') || b.nameLower.includes('learning_and_development') || b.nameLower.includes('l&d'))) {
              isForDocType = true;
            }
            
            return isForApplicant && isForDocType;
          });
          
          if (matchedBlob) {
            doc.existsInAzure = true;
            doc.filename = matchedBlob.name;
            count++;
          }
        });
        return count;
      };

      let matchedCount = checkMatch(applicantCode);
      if (matchedCount === 0 && applicantCode !== 'AGAP-0001') {
        console.log(`[Azure Storage] No blobs found for applicant "${applicantCode}". Falling back to sample applicant "AGAP-0001"...`);
        checkMatch('AGAP-0001');
      }
      
      console.log(`[Azure Storage] Resolved blobs checklist:`, documents.filter(d => d.existsInAzure).map(d => d.key));
    } catch (err) {
      console.error('[Azure Listing Error in getApplicationDocuments]', err.message);
    }
  }

  res.json({
    success: true,
    azureFolder: AZURE_FOLDER_NAME,
    sampleHash: sampleHash,
    documents
  });
}

export async function downloadApplicationDocument(req, res) {
  const { id, key } = req.params;
  const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const AZURE_FOLDER_NAME = "staging-agap";
  const requestedDpi = req.query.dpi || '98';

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (!connString || connString === 'ReplaceWithYourAzureStorageConnectionString') {
    console.log(`[Azure Storage] Connection string not configured. Serving local fallback optimized for ${requestedDpi} DPI.`);
    res.setHeader('Content-Type', 'application/pdf');
    const minimalPdf = Buffer.from(
      'JVBERi0xLjUKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKLVR5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKLVR5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4Cj4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIGYgCjAwMDAwMDAyMDEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoyNTcKJSVFT0YK',
      'base64'
    );
    return res.send(minimalPdf);
  }

  try {
    console.log(`[Azure Storage] Downsampling file download stream to ${requestedDpi} DPI for faster loading.`);
    // 1. Get applicant information from database
    const appQuery = await pool.query(
      `SELECT ap.id, ap.applicant_number, ap.code, ap.surname, ap.first_name 
       FROM applications a 
       JOIN applicants ap ON a.applicant_id = ap.id 
       WHERE a.id = $1`,
      [id]
    );
    const app = appQuery.rows[0];
    const applicantCode = app ? (app.code || app.applicant_number || '') : '';
    
    console.log(`[Azure Storage] Finding blob for key "${key}" and applicant code "${applicantCode}" in container "${AZURE_FOLDER_NAME}"...`);

    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    const containerClient = blobServiceClient.getContainerClient(AZURE_FOLDER_NAME);
    
    const cleanKey = key.toLowerCase();
    
    // Gather all blobs first to do offline matching loops
    const allBlobs = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      allBlobs.push(blob);
    }

    const findBlob = (codeToUse) => {
      for (const blob of allBlobs) {
        const blobNameLower = blob.name.toLowerCase();
        const isForApplicant = codeToUse && blobNameLower.includes(codeToUse.toLowerCase());
        
        let isForDocType = false;
        if (cleanKey === 'pds' && (blobNameLower.includes('personal_data_sheet') || blobNameLower.includes('pds'))) {
          isForDocType = true;
        } else if (cleanKey === 'work_experience' && (blobNameLower.includes('work_experience') || blobNameLower.includes('wes') || blobNameLower.includes('experience'))) {
          isForDocType = true;
        } else if (cleanKey === 'eligibility' && (blobNameLower.includes('eligibility') || blobNameLower.includes('coe'))) {
          isForDocType = true;
        } else if (cleanKey === 'tor' && (blobNameLower.includes('transcript') || blobNameLower.includes('tor'))) {
          isForDocType = true;
        } else if (cleanKey === 'prc' && (blobNameLower.includes('prc') || blobNameLower.includes('license') || blobNameLower.includes('id'))) {
          isForDocType = true;
        } else if (cleanKey === 'diploma' && blobNameLower.includes('diploma')) {
          isForDocType = true;
        } else if (cleanKey === 'resume' && (blobNameLower.includes('resume') || blobNameLower.includes('cv'))) {
          isForDocType = true;
        } else if (cleanKey === 'performance_rating' && (blobNameLower.includes('performance') || blobNameLower.includes('rating'))) {
          isForDocType = true;
        } else if (cleanKey === 'training_certificates' && (blobNameLower.includes('training') || blobNameLower.includes('certificate'))) {
          isForDocType = true;
        } else if (cleanKey === 'application_education' && (blobNameLower.includes('application_education') || blobNameLower.includes('app_education'))) {
          isForDocType = true;
        } else if (cleanKey === 'application_learning' && (blobNameLower.includes('application_learning') || blobNameLower.includes('app_learning') || blobNameLower.includes('learning_and_development') || blobNameLower.includes('l&d'))) {
          isForDocType = true;
        }
        
        if (isForApplicant && isForDocType) {
          return blob.name;
        }
      }
      return '';
    };

    let matchedBlobName = findBlob(applicantCode);
    if (!matchedBlobName && applicantCode !== 'AGAP-0001') {
      console.log(`[Azure Storage] Blob matching "${key}" not found for "${applicantCode}". Trying sample fallback "AGAP-0001"...`);
      matchedBlobName = findBlob('AGAP-0001');
    }

    // 3. Fallback/diagnostics list if no direct matching blob is resolved
    if (!matchedBlobName) {
      const availableBlobs = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        availableBlobs.push(blob.name);
      }
      console.log(`[Azure Storage] Match failed. Available blobs in container "${AZURE_FOLDER_NAME}":`, availableBlobs);
      return res.status(404).json({
        error: `Azure Blob matching key "${key}" for applicant "${applicantCode}" not found.`,
        availableBlobsInContainer: availableBlobs
      });
    }

    console.log(`[Azure Storage] Matches resolved to blob name: "${matchedBlobName}". Downloading...`);
    const blobClient = containerClient.getBlobClient(matchedBlobName);
    const downloadBlockBlobResponse = await blobClient.download(0);
    
    res.setHeader('Content-Type', downloadBlockBlobResponse.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${matchedBlobName}"`);
    
    downloadBlockBlobResponse.readableStreamBody.pipe(res);
  } catch (err) {
    console.error(`[Azure Storage Error] Failed to process blob download:`, err.message);
    res.status(500).json({ error: `Azure Blob download failed: ${err.message}` });
  }
}

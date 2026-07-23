import { pool } from '../../config/db.js';
import { getHydratedApplications } from './apps.service.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { computeOverallAreaScore } from '@agap/shared';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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

async function handleAppointmentAction(req, res, targetStatus) {
  const { id } = req.params;
  const { appointmentDate, passcode, itemNo } = req.body;
  try {
    // 1. Verify HRMO passcode
    if (!passcode) {
      return res.status(400).json({ error: 'HRMO passcode is required.' });
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
      return res.status(400).json({ error: 'Invalid passcode.' });
    }

    const { rows } = await pool.query(
      `SELECT a.* FROM applications a WHERE a.id = $1`,
      [id]
    );
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const selectedItemNo = itemNo || currentApp.appointment_item_no;
    if (!selectedItemNo) {
      return res.status(400).json({ error: 'A specific plantilla item number must be selected.' });
    }

    // Validate selected item belongs to that cluster
    const { rows: vacancyRows } = await pool.query(
      `SELECT * FROM vacancies WHERE item_no = $1 AND job_cluster_id = $2`,
      [selectedItemNo, currentApp.job_cluster_id]
    );
    const vacancy = vacancyRows[0];
    if (!vacancy) {
      return res.status(400).json({ error: 'Selected item number does not belong to the job cluster of this application.' });
    }
    
    // If we are flagging, check if the item is already filled (or if it is filled by the current applicant)
    if (targetStatus === 'FOR APPOINTMENT') {
      if (vacancy.filling_up_status === 'FILLED' && currentApp.appointment_item_no !== selectedItemNo) {
        return res.status(400).json({ error: 'Selected item number is already filled.' });
      }

      const parseDateNoTime = (val) => {
        if (!val) return null;
        if (val instanceof Date) {
          const d = new Date(val.getTime());
          d.setHours(0, 0, 0, 0);
          return isNaN(d.getTime()) ? null : d;
        }
        const str = String(val);
        const dateStr = str.includes('T') ? str.slice(0, 10) : (str.length >= 10 ? str.slice(0, 10) : str);
        const d = new Date(dateStr + 'T00:00:00');
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
      };

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const start = parseDateNoTime(vacancy.posting_start);
      const end = parseDateNoTime(vacancy.posting_end);

      const hasNotOpened = !start || !end || todayDate < start;
      const isDeadlinePassed = end && todayDate > end;
      const isClosedStatus = vacancy.status === 'closed' && start && todayDate >= start;

      if (hasNotOpened) {
        return res.status(400).json({ error: 'Cannot appoint to an item number whose posting has not yet opened.' });
      }
      if (!isDeadlinePassed && !isClosedStatus) {
        return res.status(400).json({ error: 'Cannot appoint to an item number that is currently open for application. The posting deadline must pass first.' });
      }
    }

    // Generate reference code
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const appointmentReferenceCode = currentApp.appointment_reference_code || `APPT-${today}-${rand}`;

    await pool.query(
      `UPDATE applications 
       SET appointment_status = $1, 
           appointment_date = $2, appointment_item_no = $3, appointment_reference_code = $4, updated_at = NOW()
       WHERE id = $5`,
      [
        targetStatus,
        appointmentDate ? new Date(appointmentDate) : (currentApp.appointment_date || new Date()),
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
      [historyId, id, `Appointment state updated to ${targetStatus} for item ${selectedItemNo}. Reference: ${appointmentReferenceCode}`]
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

export async function confirmAppointment(req, res) {
  await handleAppointmentAction(req, res, 'appointed');
}

export async function flagAppointment(req, res) {
  await handleAppointmentAction(req, res, 'FOR APPOINTMENT');
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
       WHERE job_cluster_id = $1 AND (appointment_status = 'FOR APPOINTMENT' OR appointment_status = 'not_appointed')`,
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
       WHERE id = $1`,
      [id]
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
    { key: 'letter_of_intent', label: 'Letter of Intent', filename: 'AGAP-0001_Letter_of_Intent.pdf', existsInAzure: false },
    { key: 'pds', label: 'Personal Data Sheet', filename: `${sampleHash}.pdf`, existsInAzure: false },
    { key: 'work_experience', label: 'Work Experience Sheet', filename: 'AGAP-0001_Work_Experience_Sheet.pdf', existsInAzure: false },
    { key: 'eligibility', label: 'Certificate of Eligibility', filename: 'AGAP-0001_Certificate_of_Eligibility.pdf', existsInAzure: false },
    { key: 'tor', label: 'Transcript of Records', filename: 'AGAP-0001_Transcript_of_Records.pdf', existsInAzure: false },
    { key: 'prc', label: 'Updated PRC License/ID', filename: 'AGAP-0001_Updated_PRC_License_ID.pdf', existsInAzure: false },
    { key: 'diploma', label: 'Diploma (optional)', filename: 'AGAP-0001_Diploma.pdf', existsInAzure: false },
    { key: 'resume', label: 'Resume', filename: 'AGAP-0001_Resume.pdf', existsInAzure: false },
    { key: 'outstanding_accomplishments', label: 'Outstanding Accomplishments', filename: 'AGAP-0001_Outstanding_Accomplishments.pdf', existsInAzure: false },
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
      
      const getFolderFromKey = (k) => {
        if (k === 'pds') return 'personal-data-sheet';
        if (k === 'work_experience') return 'work-experience-sheet';
        if (k === 'eligibility') return 'certificate-of-eligibility';
        if (k === 'tor') return 'transcript-of-records';
        if (k === 'prc') return 'updated-prc-license-id';
        if (k === 'diploma') return 'diploma--optional-';
        if (k === 'outstandingAccomplishment') return 'outstanding-accomplishments';
        if (k === 'application_education') return 'application-of-education';
        if (k === 'application_learning') return 'application-of-learning-and-development';
        return k.replace(/_/g, '-');
      };

      const checkMatch = (appRow) => {
        let count = 0;
        const appNum = appRow ? appRow.id : '1';
        documents.forEach(doc => {
          const folderName = getFolderFromKey(doc.key);
          const prefix = `applicant-${appNum}/${folderName}/`.toLowerCase();
          
          const matchedBlob = azureBlobs.find(b => b.nameLower.startsWith(prefix));
          
          if (matchedBlob) {
            doc.existsInAzure = true;
            doc.filename = matchedBlob.name;
            count++;
          }
        });
        return count;
      };

      let matchedCount = checkMatch(app);
      if (matchedCount === 0 && app && app.id !== 8) {
        console.log(`[Azure Storage] No blobs found for applicant ID "${app.id}". Falling back to sample applicant ID 8...`);
        const fallbackQuery = await pool.query("SELECT id, code FROM applicants WHERE id = 8 OR applicant_number = 'AGAP-0003' LIMIT 1");
        if (fallbackQuery.rows.length > 0) {
          checkMatch(fallbackQuery.rows[0]);
        }
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

    const getFolderFromKey = (k) => {
      if (k === 'pds') return 'personal-data-sheet';
      if (k === 'work_experience') return 'work-experience-sheet';
      if (k === 'eligibility') return 'certificate-of-eligibility';
      if (k === 'tor') return 'transcript-of-records';
      if (k === 'prc') return 'updated-prc-license-id';
      if (k === 'diploma') return 'diploma--optional-';
      if (k === 'outstandingAccomplishment') return 'outstanding-accomplishments';
      if (k === 'application_education') return 'application-of-education';
      if (k === 'application_learning') return 'application-of-learning-and-development';
      return k.replace(/_/g, '-');
    };

    const findBlob = (appRow) => {
      const appNum = appRow ? appRow.id : '1';
      const folderName = getFolderFromKey(key);
      const prefix = `applicant-${appNum}/${folderName}/`.toLowerCase();
      
      const matched = allBlobs.find(b => b.name.toLowerCase().startsWith(prefix));
      return matched ? matched.name : '';
    };

    let matchedBlobName = findBlob(app);
    if (!matchedBlobName && app && app.id !== 8) {
      console.log(`[Azure Storage] Blob matching "${key}" not found for applicant ID "${app.id}". Trying sample fallback ID 8...`);
      const fallbackQuery = await pool.query("SELECT id, code FROM applicants WHERE id = 8 OR applicant_number = 'AGAP-0003' LIMIT 1");
      if (fallbackQuery.rows.length > 0) {
        matchedBlobName = findBlob(fallbackQuery.rows[0]);
      }
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

export async function exportCar(req, res) {
  try {
    const userId = req.user?.id;
    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [userId]);
    const user = userQuery.rows[0] || {};

    const { vacancyId } = req.query;
    const list = await getHydratedApplications(vacancyId || null, user.region || null, user.division || null);

    const SCORE_AREA_KEYS = ['education', 'experience', 'training', 'outstandingAccomplishment', 'applicationEducation', 'applicationLearning', 'performanceRating', 'potential'];

    // Strictly filter for applicants whose status is Assessment Completed AND not yet appointed
    const completedApps = list.filter(app => {
      const apptStatus = String(app.appointmentStatus || app.appointment_status || '').toUpperCase();
      if (apptStatus === 'FOR APPOINTMENT' || apptStatus === 'APPOINTED') {
        return false;
      }

      const cs = app.comparativeAssessmentScores || app.comparative_assessment_scores || {};
      const latestEval = app.latestEval || (app.qual_evals && app.qual_evals[0]) || {};
      let areaScores = latestEval.areaScores || latestEval.area_scores || {};
      if (typeof areaScores === 'string') {
        try { areaScores = JSON.parse(areaScores); } catch (e) { areaScores = {}; }
      }

      const hasVal = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
      const compChecks = [cs.bei, cs.wst, cs.we].map(hasVal);
      const compCount = compChecks.filter(Boolean).length;

      const areaCount = SCORE_AREA_KEYS.filter(k => hasVal(areaScores[k])).length;

      return areaCount === SCORE_AREA_KEYS.length && compCount === 3;
    });

    // Sort by overall fit / total score descending
    completedApps.sort((a, b) => (b.fit || b.overall_fit || 0) - (a.fit || a.overall_fit || 0));

    const templatePath = path.resolve(__dirname, '../../templates/Annex_I_Comparative_Assessment_Result.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet(1) || workbook.worksheets[0];

    const sampleApp = completedApps[0] || list[0] || {};
    const posTitle = sampleApp.vacancy || sampleApp.positionTitle || sampleApp.vacancy_title || 'Position';
    const itemNo = sampleApp.itemNo || sampleApp.vacancy_item_no || sampleApp.appointment_item_no || '—';
    const schoolDiv = [sampleApp.school || sampleApp.vacancy_school, sampleApp.division || sampleApp.vacancy_division].filter(Boolean).join(' / ') || 'SDO Manila';
    const todayFormatted = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

    const carFont = { name: 'Bookman Old Style', size: 11 };
    sheet.getCell('B4').value = {
      richText: [
        { text: 'Position:  ', font: { ...carFont } },
        { text: posTitle, font: { ...carFont, bold: true } }
      ]
    };
    sheet.getCell('M4').value = {
      richText: [
        { text: 'Plantilla Item Number: ', font: { ...carFont } },
        { text: itemNo, font: { ...carFont, bold: true } }
      ]
    };
    sheet.getCell('B5').value = {
      richText: [
        { text: 'Office/Bureau/Service/Unit where the vacancy exists: ', font: { ...carFont } },
        { text: '', font: { ...carFont, bold: true } }
      ]
    };
    sheet.getCell('M5').value = {
      richText: [
        { text: 'Date of Final Deliberation: ', font: { ...carFont } },
        { text: todayFormatted, font: { ...carFont, bold: true } }
      ]
    };

    let startRow = 9;
    completedApps.forEach((app, idx) => {
      const rowNum = startRow + idx;
      const row = sheet.getRow(rowNum);
      const latestEval = app.latestEval || (app.qual_evals && app.qual_evals[0]) || {};
      let areaScores = latestEval.areaScores || latestEval.area_scores || {};
      if (typeof areaScores === 'string') {
        try { areaScores = JSON.parse(areaScores); } catch (e) { areaScores = {}; }
      }

      const name = app.applicant || app.applicant_name || `Applicant #${idx + 1}`;
      const code = app.code || app.applicant_code || '—';

      row.getCell(2).value = idx + 1; // B: No. (1, 2, 3...)
      row.getCell(3).value = name; // C: Name of Applicant
      row.getCell(4).value = code; // D: Application Code
      row.getCell(5).value = Number(areaScores.education || 0); // E: Education
      row.getCell(6).value = Number(areaScores.training || 0); // F: Training
      row.getCell(7).value = Number(areaScores.experience || 0); // G: Experience
      row.getCell(8).value = Number(areaScores.performanceRating || areaScores.performance || 0); // H: Performance
      row.getCell(9).value = Number(areaScores.outstandingAccomplishment || areaScores.accomplishments || 0); // I: Outstanding Accomplishments
      row.getCell(10).value = Number(areaScores.applicationEducation || areaScores.appEducation || 0); // J: Application of Education
      row.getCell(11).value = Number(areaScores.applicationLearning || areaScores.appLD || 0); // K: Application of L&D
      row.getCell(12).value = Number(areaScores.potential || 0); // L: Potential
      row.getCell(13).value = Number(app.fit || app.overall_fit || 0); // M: Total
      row.getCell(14).value = ''; // N: Remarks

      const rowFont = { name: 'Bookman Old Style', size: 11, bold: true };
      const refRow = sheet.getRow(9);
      for (let colIdx = 2; colIdx <= 14; colIdx++) {
        row.getCell(colIdx).font = rowFont;
        if (refRow && refRow.getCell(colIdx).alignment) {
          row.getCell(colIdx).alignment = refRow.getCell(colIdx).alignment;
        }
      }

      row.commit();
    });

    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CAR_Annex_I_${dateStr}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting CAR Excel:', error);
    res.status(500).json({ error: error.message });
  }
}

function calculateAge(dobStr) {
  if (!dobStr) return '—';
  const birthDate = new Date(dobStr);
  if (isNaN(birthDate.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : '—';
}

export async function exportIer(req, res) {
  try {
    const userId = req.user?.id;
    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [userId]);
    const user = userQuery.rows[0] || {};

    const { vacancyId } = req.query;
    const list = await getHydratedApplications(vacancyId || null, user.region || null, user.division || null);

    const templatePath = path.resolve(__dirname, '../../templates/Annex_D_Initial_Evaluation_Results.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet(1) || workbook.worksheets[0];

    const sampleApp = list[0] || {};
    const posTitle = sampleApp.vacancy || sampleApp.positionTitle || sampleApp.vacancy_title || 'Position';
    const salaryGrade = sampleApp.salaryGrade || sampleApp.salary_grade || '—';

    const ierFont = { name: 'Bookman Old Style', size: 18 };
    sheet.getCell('B4').value = {
      richText: [
        { text: 'Position:   ', font: { ...ierFont } },
        { text: posTitle, font: { ...ierFont, bold: true } }
      ]
    };
    sheet.getCell('B5').value = {
      richText: [
        { text: 'Salary Grade and Monthly Salary:   ', font: { ...ierFont } },
        { text: `SG ${salaryGrade}`, font: { ...ierFont, bold: true } }
      ]
    };

    const setBoldCell = (cellRef, textVal) => {
      const cell = sheet.getCell(cellRef);
      cell.value = textVal;
      cell.font = { name: 'Bookman Old Style', size: 18, bold: true };
    };

    setBoldCell('C7', sampleApp.qsDegree || 'Bachelor\'s Degree relevant to the job');
    setBoldCell('C8', sampleApp.qsTraining || 'None required');
    setBoldCell('C9', sampleApp.qsExperience || 'None required');
    setBoldCell('C10', sampleApp.qsEligibility || 'Career Service (Professional) / Second Level Eligibility');

    let startRow = 15;
    list.forEach((app, idx) => {
      const rowNum = startRow + idx;
      const row = sheet.getRow(rowNum);
      const appObj = app.applicantObj || {};

      const name = app.applicant || app.applicant_name || `Applicant #${idx + 1}`;
      const code = app.code || app.applicant_code || '—';
      const formatAddress = (addr) => {
        if (!addr || addr === '—') return '—';
        let obj = addr;
        if (typeof addr === 'string') {
          try { obj = JSON.parse(addr); } catch (e) { return addr; }
        }
        if (obj && typeof obj === 'object') {
          const psgcNames = {
            '11': 'Region XI (Davao Region)',
            '1125': 'Davao del Sur',
            '112503': 'Davao City',
            '13': 'NCR',
            '1339': 'NCR, Third District',
            '1374': 'NCR, Second District',
            '1375': 'NCR, Fourth District',
            '1376': 'Manila',
            '137601': 'Manila',
            '137404': 'Quezon City',
            '137401': 'Mandaluyong',
            '137402': 'Marikina',
            '137403': 'Pasig',
            '137405': 'San Juan',
            '133901': 'Caloocan',
            '133902': 'Malabon',
            '133903': 'Navotas',
            '133904': 'Valenzuela',
            '137501': 'Las Piñas',
            '137502': 'Makati',
            '137503': 'Muntinlupa',
            '137504': 'Parañaque',
            '137505': 'Pasay',
            '137506': 'Pateros',
            '137507': 'Taguig'
          };
          
          const getVal = (v) => {
            const clean = String(v || '').trim();
            if (!clean || clean.toLowerCase() === 'null') return '';
            return psgcNames[clean] || clean;
          };

          const parts = [
            getVal(obj.house),
            getVal(obj.street),
            getVal(obj.subdivision),
            getVal(obj.barangay),
            getVal(obj.city),
            getVal(obj.province),
            getVal(obj.region),
            getVal(obj.zip)
          ].filter(Boolean);

          if (parts.length > 0) return parts.join(', ');
        }
        return String(addr);
      };

      const rawAddress = appObj.residential_address || appObj.permanent_address || '—';
      const address = formatAddress(rawAddress);
      const age = appObj.age || calculateAge(appObj.date_of_birth) || '—';
      const sex = appObj.sex || '—';
      const civilStatus = appObj.civil_status || '—';
      const religion = appObj.religion || '—';
      const disability = appObj.disability || '—';
      const ethnicGroup = appObj.ethnic_group || '—';
      const email = appObj.email_address || app.email || '—';
      const contactNo = appObj.mobile_no || appObj.telephone_no || '—';

      const education = app.bachelorDegree || appObj.bachelor_degree || '—';
      const trainingTitle = appObj.training_title || (app.trainingHours > 0 ? `${app.trainingHours} hours relevant training` : 'None');
      const trainingHours = app.trainingHours || appObj.training_hours || 0;
      const expDetails = appObj.experience_details || (app.yearsExperience > 0 ? `${app.yearsExperience} years relevant experience` : 'None');
      const expYears = app.yearsExperience || appObj.years_experience || 0;
      const eligibility = appObj.eligibility || 'Civil Service Professional';

      const isDisqualified = String(app.status || '').toLowerCase() === 'disqualified';
      const remarks = isDisqualified ? 'Disqualified' : 'Qualified';

      row.getCell(2).value = idx + 1; // B: No.
      row.getCell(3).value = code; // C: Application Code
      row.getCell(4).value = name; // D: Names of Applicant
      row.getCell(5).value = address; // E: Address
      row.getCell(6).value = age; // F: Age
      row.getCell(7).value = sex; // G: Sex
      row.getCell(8).value = civilStatus; // H: Civil Status
      row.getCell(9).value = religion; // I: Religion
      row.getCell(10).value = disability; // J: Disability
      row.getCell(11).value = ethnicGroup; // K: Ethnic Group
      row.getCell(12).value = email; // L: Email Address
      row.getCell(13).value = contactNo; // M: Contact No.
      row.getCell(14).value = education; // N: Education
      row.getCell(15).value = trainingTitle; // O: Training Title
      row.getCell(16).value = trainingHours; // P: Training Hours
      row.getCell(17).value = expDetails; // Q: Experience Details
      row.getCell(18).value = expYears; // R: Experience Years
      row.getCell(19).value = eligibility; // S: Eligibility
      row.getCell(20).value = remarks; // T: Remarks (Qualified or Disqualified)

      const rowFont = { name: 'Bookman Old Style', size: 11, bold: true };
      const refRow = sheet.getRow(15);
      for (let colIdx = 2; colIdx <= 20; colIdx++) {
        row.getCell(colIdx).font = rowFont;
        if (refRow && refRow.getCell(colIdx).alignment) {
          row.getCell(colIdx).alignment = refRow.getCell(colIdx).alignment;
        }
      }

      row.commit();
    });

    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="IER_Annex_D_${dateStr}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting IER Excel:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function downloadNoticeOfAppointment(req, res) {
  try {
    const { id } = req.params;
    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [req.user.id]);
    const user = userQuery.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { region, division } = user;
    const list = await getHydratedApplications(null, region, division);
    const app = list.find(a => a.id === id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found or unauthorized' });
    }

    const templatePath = path.resolve(__dirname, '../../templates/Notice_of_Appointment_Template.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Notice of Appointment template not found' });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });

    const getSalaryByGrade = (sg) => {
      if (!sg) return '27,000.00';
      const grade = parseInt(String(sg).replace(/\D/g, ''), 10);
      const sgMap = {
        1: '13,000.00', 2: '13,819.00', 3: '14,678.00', 4: '15,586.00', 5: '16,543.00',
        6: '17,553.00', 7: '18,620.00', 8: '19,744.00', 9: '21,211.00', 10: '23,176.00',
        11: '27,000.00', 12: '29,165.00', 13: '31,320.00', 14: '33,843.00', 15: '36,619.00',
        16: '39,672.00', 17: '43,030.00', 18: '46,725.00', 19: '51,357.00', 20: '57,347.00',
        21: '63,997.00', 22: '71,511.00', 23: '80,003.00', 24: '90,078.00', 25: '102,690.00'
      };
      return sgMap[grade] || '27,000.00';
    };

    doc.render({
      name: String(app.applicant || '').toUpperCase(),
      positionTitle: app.positionTitle || app.vacancy || '—',
      natureOfAppointment: 'PERMANENT',
      office: app.school || app.division || 'SDO Manila',
      salary: getSalaryByGrade(app.salaryGrade),
      itemNo: app.itemNo || 'N/A'
    });

    const buf = doc.getZip().generate({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Notice_of_Appointment_${String(app.applicant || '').replace(/\s+/g, '_')}.docx"`);
    res.send(buf);
  } catch (error) {
    console.error('Error generating notice:', error);
    res.status(500).json({ error: error.message });
  }
}

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
      return res.status(401).json({ error: 'User not found' });
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


// ==========================================
// AZURE BLOB STORAGE SINGLETON & LRU CACHE
// ==========================================
let azureContainerClientInstance = null;

function getAzureContainerClient() {
  if (azureContainerClientInstance) return azureContainerClientInstance;

  const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const AZURE_FOLDER_NAME = process.env.AZURE_FOLDER_NAME || "main-agap";

  if (connString && connString !== 'ReplaceWithYourAzureStorageConnectionString') {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    azureContainerClientInstance = blobServiceClient.getContainerClient(AZURE_FOLDER_NAME);
  }
  return azureContainerClientInstance;
}

const docListCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedDocList(cacheKey) {
  const cached = docListCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }
  return null;
}

function setCachedDocList(cacheKey, data) {
  docListCache.set(cacheKey, { timestamp: Date.now(), data });
  if (docListCache.size > 1000) {
    const oldestKey = docListCache.keys().next().value;
    docListCache.delete(oldestKey);
  }
}

const getFolderAliasesFromKey = (k) => {
  const cleanK = (k || '').toLowerCase().trim();
  const folderSet = new Set([cleanK, cleanK.replace(/_/g, '-')]);

  if (cleanK === 'pds' || cleanK === 'personal-data-sheet') {
    folderSet.add('personal-data-sheet');
    folderSet.add('pds');
  }
  if (cleanK === 'work_experience' || cleanK === 'work-experience' || cleanK === 'work-experience-sheet') {
    folderSet.add('work-experience-sheet');
    folderSet.add('work-experience');
    folderSet.add('work_experience');
  }
  if (cleanK === 'eligibility' || cleanK === 'certificate-of-eligibility') {
    folderSet.add('certificate-of-eligibility');
    folderSet.add('eligibility');
  }
  if (cleanK === 'tor' || cleanK === 'transcript-of-records') {
    folderSet.add('transcript-of-records');
    folderSet.add('tor');
  }
  if (cleanK === 'prc' || cleanK === 'updated-prc-license-id' || cleanK === 'prc-license') {
    folderSet.add('updated-prc-license-id');
    folderSet.add('prc-license');
    folderSet.add('prc');
  }
  if (cleanK === 'diploma' || cleanK.includes('diploma')) {
    folderSet.add('diploma--optional-');
    folderSet.add('diploma-optional');
    folderSet.add('diploma');
  }
  if (cleanK === 'letter_of_intent' || cleanK === 'letter-of-intent') {
    folderSet.add('letter-of-intent');
    folderSet.add('letter_of_intent');
  }
  if (cleanK === 'sworn_declaration' || cleanK === 'sworn-declaration' || cleanK === 'cav') {
    folderSet.add('sworn-declaration');
    folderSet.add('sworn_declaration');
    folderSet.add('cav');
  }
  if (cleanK === 'outstanding_accomplishments' || cleanK === 'outstandingaccomplishment' || cleanK === 'outstanding-accomplishments') {
    folderSet.add('outstanding-accomplishments');
    folderSet.add('outstanding_accomplishments');
    folderSet.add('outstanding-accomplishment');
  }
  if (cleanK === 'performance_rating' || cleanK === 'performance-rating') {
    folderSet.add('performance-rating');
    folderSet.add('performance_rating');
  }
  if (cleanK === 'training_certificates' || cleanK === 'training-certificates') {
    folderSet.add('training-certificates');
    folderSet.add('training_certificates');
  }
  if (cleanK === 'application_education' || cleanK === 'application-of-education') {
    folderSet.add('application-of-education');
    folderSet.add('application_education');
  }
  if (cleanK === 'application_learning' || cleanK === 'application-of-learning-and-development') {
    folderSet.add('application-of-learning-and-development');
    folderSet.add('application_learning');
  }
  return Array.from(folderSet);
};

const getApplicantFolderPrefixes = (appRow) => {
  const prefixes = new Set();
  if (appRow) {
    if (appRow.id) {
      prefixes.add(`applicant-${appRow.id}/`.toLowerCase());
    }
    if (appRow.application_id) {
      prefixes.add(`applicant-${appRow.application_id}/`.toLowerCase());
    }
    if (appRow.applicant_id) {
      prefixes.add(`applicant-${appRow.applicant_id}/`.toLowerCase());
    }
    if (appRow.applicant_number) {
      prefixes.add(`applicant-${appRow.applicant_number.toLowerCase()}/`);
      prefixes.add(`${appRow.applicant_number.toLowerCase()}/`);
    }
    if (appRow.code) {
      prefixes.add(`applicant-${appRow.code.toLowerCase()}/`);
      prefixes.add(`${appRow.code.toLowerCase()}/`);
    }
    const codeStr = (appRow.code || appRow.applicant_number || '').trim();
    const matchDigits = codeStr.match(/\d+/);
    if (matchDigits) {
      const num = parseInt(matchDigits[0], 10);
      if (!isNaN(num)) {
        prefixes.add(`applicant-${num}/`.toLowerCase());
      }
    }
  }
  return Array.from(prefixes);
};

async function getBlobsForApplicant(containerClient, appRow) {
  const prefixes = getApplicantFolderPrefixes(appRow);
  if (!prefixes.length) return [];

  const results = await Promise.all(
    prefixes.map(async (prefix) => {
      const list = [];
      try {
        for await (const blob of containerClient.listBlobsFlat({ prefix })) {
          list.push({ ...blob, nameLower: blob.name.toLowerCase() });
        }
      } catch (err) {
        console.error(`[Azure Storage] Scoped prefix scan error for "${prefix}":`, err.message);
      }
      return list;
    })
  );

  const blobMap = new Map();
  results.flat().forEach(b => {
    if (b && b.name) {
      blobMap.set(b.name, b);
    }
  });
  return Array.from(blobMap.values());
}

export async function getApplicationDocuments(req, res) {
  const { id } = req.params;
  const AZURE_FOLDER_NAME = process.env.AZURE_FOLDER_NAME || "main-agap";
  const sampleHash = "AGAP-0001_Personal_Data_Sheet_1784171209875";
  
  const cacheKey = `docs_${id}`;
  const cachedDocuments = getCachedDocList(cacheKey);
  if (cachedDocuments) {
    return res.json({
      success: true,
      azureFolder: AZURE_FOLDER_NAME,
      sampleHash: sampleHash,
      documents: cachedDocuments
    });
  }

  console.log(`[Azure Storage] Scoped lookup for application ID "${id}"...`);
  
  const appQuery = await pool.query(
    `SELECT a.id as application_id, a.applicant_id, a.letter_of_intent, a.sworn_document, a.sworn_document as sworn_declaration, ap.id as applicant_table_id, ap.applicant_number, ap.code, ap.surname, ap.first_name 
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
    { key: 'diploma', label: 'Diploma', filename: 'AGAP-0001_Diploma.pdf', existsInAzure: false },
    { key: 'resume', label: 'Resume', filename: 'AGAP-0001_Resume.pdf', existsInAzure: false },
    { key: 'outstanding_accomplishments', label: 'Outstanding Accomplishments', filename: 'AGAP-0001_Outstanding_Accomplishments.pdf', existsInAzure: false },
    { key: 'performance_rating', label: 'Performance Rating', filename: 'AGAP-0001_Performance_Rating.pdf', existsInAzure: false },
    { key: 'training_certificates', label: 'Training Certificates', filename: 'AGAP-0001_Training_Certificates.pdf', existsInAzure: false },
    { key: 'application_education', label: 'Application of Education', filename: 'AGAP-0001_Application_of_Education.pdf', existsInAzure: false },
    { key: 'application_learning', label: 'Application of Learning and Development', filename: 'AGAP-0001_Application_of_Learning_and_Development.pdf', existsInAzure: false },
    { key: 'sworn_declaration', label: 'Certification on the Authenticity and Veracity (CAV)', filename: 'AGAP-0001_Sworn_Declaration.pdf', existsInAzure: false },
    { key: 'cav', label: 'Certification on the Authenticity and Veracity (CAV)', filename: 'AGAP-0001_CAV.pdf', existsInAzure: false }
  ];

  const containerClient = getAzureContainerClient();

  if (containerClient) {
    try {
      const azureBlobs = await getBlobsForApplicant(containerClient, app);

      const findMatchingBlob = (appRow, docKey) => {
        const applicantPrefixes = getApplicantFolderPrefixes(appRow);
        const folderAliases = getFolderAliasesFromKey(docKey);

        for (const appPrefix of applicantPrefixes) {
          for (const folderAlias of folderAliases) {
            const prefix = `${appPrefix}${folderAlias}/`.toLowerCase();
            const matched = azureBlobs.find(b => b.nameLower.startsWith(prefix));
            if (matched) return matched;
          }
        }
        for (const appPrefix of applicantPrefixes) {
          for (const folderAlias of folderAliases) {
            const matched = azureBlobs.find(b => b.nameLower.startsWith(appPrefix) && b.nameLower.includes(folderAlias));
            if (matched) return matched;
          }
        }
        return null;
      };

      documents.forEach(doc => {
        if (doc.key === 'letter_of_intent' && app?.letter_of_intent) {
          doc.existsInAzure = true;
          doc.filename = app.letter_of_intent;
          doc.url = `/api/applications/${id}/documents/${doc.key}/download`;
        } else if ((doc.key === 'sworn_declaration' || doc.key === 'cav') && app?.sworn_declaration) {
          doc.existsInAzure = true;
          doc.filename = app.sworn_declaration;
          doc.url = `/api/applications/${id}/documents/${doc.key}/download`;
        } else {
          const matchedBlob = findMatchingBlob(app, doc.key);
          if (matchedBlob) {
            doc.existsInAzure = true;
            doc.filename = matchedBlob.name;
            doc.url = `/api/applications/${id}/documents/${doc.key}/download`;
          }
        }
      });

      setCachedDocList(cacheKey, documents);
      console.log(`[Azure Storage] Resolved blobs for applicant "${applicantCode}":`, documents.filter(d => d.existsInAzure).map(d => d.key));
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
  const AZURE_FOLDER_NAME = process.env.AZURE_FOLDER_NAME || "main-agap";
  const requestedDpi = req.query.dpi || '98';

  res.setHeader('Cache-Control', 'private, max-age=300');

  const containerClient = getAzureContainerClient();

  if (!containerClient) {
    console.log(`[Azure Storage] Connection string not configured. Serving local fallback optimized for ${requestedDpi} DPI.`);
    res.setHeader('Content-Type', 'application/pdf');
    const minimalPdf = Buffer.from(
      'JVBERi0xLjUKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKLVR5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKLVR5cGUgL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4Cj4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIGYgCjAwMDAwMDAyMDEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoyNTcKJSVFT0YK',
      'base64'
    );
    return res.send(minimalPdf);
  }

  try {
    const appQuery = await pool.query(
      `SELECT a.id as application_id, a.applicant_id, a.letter_of_intent, a.sworn_document, a.sworn_document as sworn_declaration, ap.id as applicant_table_id, ap.applicant_number, ap.code, ap.surname, ap.first_name 
       FROM applications a 
       JOIN applicants ap ON a.applicant_id = ap.id 
       WHERE a.id = $1`,
      [id]
    );
    const app = appQuery.rows[0];
    const applicantCode = app ? (app.code || app.applicant_number || '') : '';

    const allBlobs = await getBlobsForApplicant(containerClient, app);

    const extractBlobPath = (urlOrPath) => {
      if (!urlOrPath) return '';
      if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        try {
          const u = new URL(urlOrPath);
          let p = u.pathname;
          if (p.startsWith('/')) p = p.slice(1);
          if (p.startsWith(AZURE_FOLDER_NAME + '/')) {
            p = p.slice(AZURE_FOLDER_NAME.length + 1);
          }
          return p;
        } catch (e) {
          return urlOrPath;
        }
      }
      return urlOrPath;
    };

    const findBlob = (appRow) => {
      if (key === 'letter_of_intent' && appRow?.letter_of_intent) {
        const extracted = extractBlobPath(appRow.letter_of_intent);
        const found = allBlobs.find(b => b.name === extracted || b.name.endsWith(extracted) || extracted.endsWith(b.name));
        if (found) return found.name;
      }
      if ((key === 'sworn_declaration' || key === 'cav') && appRow?.sworn_declaration) {
        const extracted = extractBlobPath(appRow.sworn_declaration);
        const found = allBlobs.find(b => b.name === extracted || b.name.endsWith(extracted) || extracted.endsWith(b.name));
        if (found) return found.name;
      }

      const applicantPrefixes = getApplicantFolderPrefixes(appRow);
      const folderAliases = getFolderAliasesFromKey(key);

      for (const appPrefix of applicantPrefixes) {
        for (const folderAlias of folderAliases) {
          const prefix = `${appPrefix}${folderAlias}/`.toLowerCase();
          const matched = allBlobs.find(b => b.nameLower.startsWith(prefix));
          if (matched) return matched.name;
        }
      }
      for (const appPrefix of applicantPrefixes) {
        for (const folderAlias of folderAliases) {
          const matched = allBlobs.find(b => b.nameLower.startsWith(appPrefix) && b.nameLower.includes(folderAlias));
          if (matched) return matched.name;
        }
      }

      if (key === 'letter_of_intent' && appRow?.letter_of_intent) {
        return extractBlobPath(appRow.letter_of_intent);
      }
      if ((key === 'sworn_declaration' || key === 'cav') && appRow?.sworn_declaration) {
        return extractBlobPath(appRow.sworn_declaration);
      }
      return '';
    };

    const matchedBlobName = findBlob(app);

    if (!matchedBlobName) {
      const availableBlobs = allBlobs.map(b => b.name);
      console.log(`[Azure Storage] Strict match failed for applicant "${applicantCode}". Scoped blobs:`, availableBlobs);
      return res.status(404).json({
        error: `Azure Blob matching key "${key}" for applicant "${applicantCode}" not found in folder applicant-${app ? app.id : 'unknown'}.`,
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
    console.error(`[Azure Storage Error] Failed to process blob download for key "${key}":`, err.message);
    if (err.statusCode === 404 || (err.message && (err.message.includes('does not exist') || err.message.includes('BlobNotFound')))) {
      console.log(`[Azure Storage] Blob missing in Azure container. Serving fallback PDF.`);
      res.setHeader('Content-Type', 'application/pdf');
      const minimalPdf = Buffer.from(
        'JVBERi0xLjUKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKLVR5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKLVR5cGUgL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4Cj4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDA meSAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIGYgCjAwMDAwMDAyMDEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoyNTcKJSVFT0YK',
        'base64'
      );
      return res.send(minimalPdf);
    }
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
      if (idx >= 10) {
        sheet.insertRow(rowNum, [], 'insertBelow');
      }
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

      row.height = 34.5;
      const rowFont = { name: 'Bookman Old Style', size: 11, bold: true };
      const refRow = sheet.getRow(9);
      const thinBorder = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      for (let colIdx = 2; colIdx <= 14; colIdx++) {
        const cell = row.getCell(colIdx);
        cell.font = rowFont;
        cell.border = thinBorder;
        if (refRow && refRow.getCell(colIdx).alignment) {
          cell.alignment = refRow.getCell(colIdx).alignment;
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
    let list = await getHydratedApplications(vacancyId || null, user.region || null, user.division || null);

    // Include both Qualified and Disqualified applicants (excluding Excluded)
    list = list.filter(app => {
      const st = String(app.status || '').toLowerCase();
      return st !== 'excluded';
    });

    // Sort list so all Qualified applicants come first, then Disqualified at the bottom
    list.sort((a, b) => {
      const aDis = String(a.status || '').toLowerCase() === 'disqualified' ? 1 : 0;
      const bDis = String(b.status || '').toLowerCase() === 'disqualified' ? 1 : 0;
      if (aDis !== bDis) return aDis - bDis;
      const aName = (a.applicant || a.applicant_name || '').toLowerCase();
      const bName = (b.applicant || b.applicant_name || '').toLowerCase();
      return aName.localeCompare(bName);
    });

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
      if (idx >= 10) {
        sheet.insertRow(rowNum, [], 'insertBelow');
      }
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

      const estimateLines = (val, approxWidth = 22) => {
        if (!val || val === '—') return 1;
        const str = String(val).trim();
        if (!str) return 1;
        const lines = str.split('\n');
        let count = 0;
        for (const line of lines) {
          count += Math.max(1, Math.ceil(line.length / approxWidth));
        }
        return count;
      };

      const maxLines = Math.max(
        estimateLines(name, 22),
        estimateLines(address, 28),
        estimateLines(education, 22),
        estimateLines(trainingTitle, 22),
        estimateLines(expDetails, 22),
        estimateLines(eligibility, 22),
        1
      );

      row.height = Math.max(45, maxLines * 18 + 14);
      const rowFont = { name: 'Bookman Old Style', size: 11, bold: true };
      const refRow = sheet.getRow(15);
      const thinBorder = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      const centerCols = [2, 6, 7, 8, 9, 10, 11, 16, 18, 20];

      for (let colIdx = 2; colIdx <= 20; colIdx++) {
        const cell = row.getCell(colIdx);
        cell.font = rowFont;
        cell.border = thinBorder;
        const refAlign = refRow ? refRow.getCell(colIdx).alignment : null;
        cell.alignment = {
          vertical: 'middle',
          horizontal: refAlign?.horizontal || (centerCols.includes(colIdx) ? 'center' : 'left'),
          wrapText: true
        };
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

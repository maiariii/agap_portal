import { pool } from '../../config/db.js';
import { getHydratedApplications } from './apps.service.js';
import { fetchApplicantDocumentsFromAuditLogs, isUploadedInOpenPeriod, DOCUMENT_TYPE_MAP } from './documents.service.js';
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
    const userId = req.user?.id || req.user?.userId;
    let region = req.user?.region || null;
    let division = req.user?.division || null;

    if (userId) {
      const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [userId]);
      const user = userQuery.rows[0];
      if (user) {
        region = user.region || region;
        division = user.division || division;
      }
    }

    const list = await getHydratedApplications(null, region, division);
    res.json(list);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch applications' });
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

    // Allow score updates regardless of appointment status
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
    
    // Capacity check: block appointment if the item or vacancy cluster slots are fully occupied
    if (targetStatus === 'FOR APPOINTMENT' || targetStatus === 'appointed') {
      const { rows: clusterVacancies } = await pool.query(
        `SELECT filling_up_status FROM vacancies WHERE job_cluster_id = $1`,
        [currentApp.job_cluster_id]
      );
      const totalSlots = clusterVacancies.length;
      const filledSlots = clusterVacancies.filter(v => v.filling_up_status === 'FILLED').length;
      const isItemFilled = vacancy.filling_up_status === 'FILLED' && currentApp.appointment_item_no !== selectedItemNo;

      if (isItemFilled || (filledSlots >= totalSlots && currentApp.appointment_item_no !== selectedItemNo)) {
        return res.status(400).json({ error: 'No unfilled items remaining for this vacancy' });
      }
    }

    if (targetStatus === 'FOR APPOINTMENT') {

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

    // Other applicants in the job cluster remain untouched with their existing appointment_status

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
    folderSet.add('notarized-personal-data-sheet');
    folderSet.add('notarized_personal_data_sheet');
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
  if (cleanK === 'resume' || cleanK.includes('resume')) {
    folderSet.add('resume');
  }
  if (cleanK === 'coe' || cleanK === 'certificate_of_employment' || cleanK === 'certificate-of-employment' || cleanK.includes('employment')) {
    folderSet.add('certificate-of-employment');
    folderSet.add('certificate_of_employment');
    folderSet.add('certificate-of-employment-coe');
    folderSet.add('coe');
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

const getApplicantFolderPrefixes = (appRow, appSpecificOnly = false) => {
  const prefixes = new Set();
  if (appRow) {
    if (appSpecificOnly) {
      if (appRow.id) {
        prefixes.add(`applicant-${appRow.id}/`.toLowerCase());
      }
      if (appRow.application_id) {
        prefixes.add(`applicant-${appRow.application_id}/`.toLowerCase());
      }
    } else {
      if (appRow.applicant_id) {
        prefixes.add(`applicant-${appRow.applicant_id}/`.toLowerCase());
      }
      if (appRow.applicant_number) {
        prefixes.add(`applicant-${appRow.applicant_number.toLowerCase()}/`);
      }
      if (appRow.code) {
        prefixes.add(`applicant-${appRow.code.toLowerCase()}/`);
      }
      if (appRow.id) {
        prefixes.add(`applicant-${appRow.id}/`.toLowerCase());
      }
      if (appRow.application_id) {
        prefixes.add(`applicant-${appRow.application_id}/`.toLowerCase());
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
          const lastMod = blob.properties?.lastModified ? new Date(blob.properties.lastModified).getTime() : 0;
          list.push({
            ...blob,
            nameLower: blob.name.toLowerCase(),
            lastModified: lastMod
          });
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

  // Sort blobs descending by lastModified timestamp (newest/latest file first)
  return Array.from(blobMap.values()).sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
}

export function clearDocListCache() {
  docListCache.clear();
}

export async function getApplicationDocuments(req, res) {
  const { id } = req.params;
  if (!id || id === 'undefined' || id === 'null' || id === 'invalid') {
    return res.status(400).json({ error: 'Invalid application ID provided' });
  }
  const AZURE_FOLDER_NAME = process.env.AZURE_FOLDER_NAME || "main-agap";

  try {
    const appQuery = await pool.query(
    `SELECT a.id as application_id, a.applicant_id, a.job_cluster_id, a.documents as app_documents, a.letter_of_intent, a.sworn_document, a.sworn_document as sworn_declaration, ap.id as applicant_table_id, ap.applicant_number, ap.code, ap.surname, ap.first_name, ap.other_information, v.id as vacancy_id, v.division, v.status as vacancy_status, v.doc_fetch_preference, v.has_fetched_docs 
     FROM applications a 
     JOIN applicants ap ON a.applicant_id = ap.id 
     LEFT JOIN vacancies v ON (a.job_cluster_id IS NOT NULL AND a.job_cluster_id = v.job_cluster_id)
     WHERE a.id = $1`,
    [id]
  );
  const app = appQuery.rows[0];
  const applicantCode = app ? (app.code || app.applicant_number || app.applicant_id || id) : id;

  // Query audit logs using division status logic (Closed vs Open)
  const auditLogResult = await fetchApplicantDocumentsFromAuditLogs({
    applicantId: app?.applicant_id,
    applicationId: id,
    vacancyId: app?.vacancy_id,
    jobClusterId: app?.job_cluster_id,
    division: app?.division
  });

  const cacheKey = `docs_${id}_${auditLogResult.docFetchPreference}`;
  const forceRefresh = req.query.refresh === 'true' || req.query.nocache === 'true';
  const cachedDocuments = forceRefresh ? null : getCachedDocList(cacheKey);
  if (cachedDocuments) {
    return res.json({
      success: true,
      azureFolder: AZURE_FOLDER_NAME,
      documents: cachedDocuments
    });
  }

  console.log(`[Azure Storage] Scoped lookup for application ID "${id}"...`);

  const documents = [
    { key: 'letter_of_intent', label: 'Letter of Intent', filename: `${applicantCode}_Letter_of_Intent.pdf`, existsInAzure: false },
    { key: 'pds', label: 'Personal Data Sheet', filename: `${applicantCode}_Personal_Data_Sheet.pdf`, existsInAzure: false },
    { key: 'work_experience', label: 'Work Experience Sheet', filename: `${applicantCode}_Work_Experience_Sheet.pdf`, existsInAzure: false },
    { key: 'eligibility', label: 'Certificate of Eligibility', filename: `${applicantCode}_Certificate_of_Eligibility.pdf`, existsInAzure: false },
    { key: 'tor', label: 'Transcript of Records', filename: `${applicantCode}_Transcript_of_Records.pdf`, existsInAzure: false },
    { key: 'prc', label: 'Updated PRC License/ID', filename: `${applicantCode}_Updated_PRC_License_ID.pdf`, existsInAzure: false },
    { key: 'diploma', label: 'Diploma', filename: `${applicantCode}_Diploma.pdf`, existsInAzure: false },
    { key: 'resume', label: 'Resume', filename: `${applicantCode}_Resume.pdf`, existsInAzure: false },
    { key: 'coe', label: 'Certificate of Employment', filename: `${applicantCode}_Certificate_of_Employment.pdf`, existsInAzure: false },
    { key: 'outstanding_accomplishments', label: 'Outstanding Accomplishments', filename: `${applicantCode}_Outstanding_Accomplishments.pdf`, existsInAzure: false },
    { key: 'performance_rating', label: 'Performance Rating', filename: `${applicantCode}_Performance_Rating.pdf`, existsInAzure: false },
    { key: 'training_certificates', label: 'Training Certificates', filename: `${applicantCode}_Training_Certificates.pdf`, existsInAzure: false },
    { key: 'application_education', label: 'Application of Education', filename: `${applicantCode}_Application_of_Education.pdf`, existsInAzure: false },
    { key: 'application_learning', label: 'Application of Learning and Development', filename: `${applicantCode}_Application_of_Learning_and_Development.pdf`, existsInAzure: false },
    { key: 'sworn_declaration', label: 'Certification on the Authenticity and Veracity (CAV)', filename: `${applicantCode}_Sworn_Declaration.pdf`, existsInAzure: false },
    { key: 'cav', label: 'Certification on the Authenticity and Veracity (CAV)', filename: `${applicantCode}_CAV.pdf`, existsInAzure: false }
  ];

  console.log(`[getApplicationDocuments] 🚀 Processing lookup for App ID "${id}", Applicant Code "${applicantCode}", Applicant ID "${app?.applicant_id}"`);

  // 1. Match from document_audit_logs first
  if (auditLogResult.documents && auditLogResult.documents.length > 0) {
    documents.forEach(doc => {
      const mappedTypes = DOCUMENT_TYPE_MAP[doc.key] || [];
      const matchedAudit = auditLogResult.documents.find(a => 
        mappedTypes.some(mt => mt.toLowerCase() === (a.document_type || '').toLowerCase())
      );
      if (matchedAudit) {
        doc.existsInAzure = true;
        const targetUrl = matchedAudit.new_blob_url || matchedAudit.effective_blob_url || matchedAudit.current_blob_url;
        if (targetUrl) {
          doc.filename = targetUrl.split('/').pop();
        }
        doc.uploadedAt = matchedAudit.uploaded_at;
        doc.currentBlobUrl = matchedAudit.current_blob_url;
        doc.latestBlobUrl = matchedAudit.latest_blob_url;
        doc.effectiveBlobUrl = matchedAudit.effective_blob_url;
        doc.isLatest = matchedAudit.is_latest;
        doc.newBlobUrl = matchedAudit.new_blob_url;
        doc.url = `/api/applications/${id}/documents/${doc.key}/download`;
        console.log(`[getApplicationDocuments] 🟢 Matched audit log for "${doc.key}" (${doc.label}) -> URL: ${doc.url}`);
      }
    });
  }

  // 2. Resolve baseline documents from applicant's other_information.documents or application.documents
  const otherDocs = app?.other_information?.documents || {};
  let parsedAppDocs = {};
  if (app?.app_documents) {
    try {
      parsedAppDocs = typeof app.app_documents === 'string' ? JSON.parse(app.app_documents) : app.app_documents;
    } catch (e) {}
  }

  documents.forEach(doc => {
    if (doc.existsInAzure) return;

    const mappedTypes = DOCUMENT_TYPE_MAP[doc.key] || [doc.label];
    let baselineUrl = null;

    for (const mt of mappedTypes) {
      if (parsedAppDocs[mt] || parsedAppDocs[doc.key]) {
        baselineUrl = parsedAppDocs[mt] || parsedAppDocs[doc.key];
        break;
      }
      if (otherDocs[mt] || otherDocs[doc.key]) {
        baselineUrl = otherDocs[mt] || otherDocs[doc.key];
        break;
      }
    }

    if (baselineUrl && typeof baselineUrl === 'string') {
      doc.existsInAzure = true;
      doc.filename = baselineUrl.split('/').pop();
      doc.currentBlobUrl = baselineUrl;
      doc.latestBlobUrl = baselineUrl;
      doc.effectiveBlobUrl = baselineUrl;
      doc.isLatest = true;
      doc.url = `/api/applications/${id}/documents/${doc.key}/download`;
    }
  });

  const containerClient = getAzureContainerClient();

  if (containerClient) {
    const hasAuditLogDocs = auditLogResult.documents && auditLogResult.documents.length > 0;
    const hasUnresolvedDocs = !hasAuditLogDocs && documents.some(d => !d.existsInAzure);
    if (hasUnresolvedDocs) {
      try {
        let azureBlobs = await getBlobsForApplicant(containerClient, app);
        if (auditLogResult.openIntervals && auditLogResult.openIntervals.length > 0) {
          azureBlobs = azureBlobs.filter(b => b.lastModified ? isUploadedInOpenPeriod(b.lastModified, auditLogResult.openIntervals) : true);
        }
        if (auditLogResult.cutoffDate) {
          const cutoffMs = new Date(auditLogResult.cutoffDate).getTime();
          azureBlobs = azureBlobs.filter(b => (b.lastModified || 0) <= cutoffMs);
        }
        azureBlobs.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

        const findMatchingBlob = (appRow, docKey) => {
          const isAppSpecific = ['letter_of_intent', 'sworn_declaration', 'sworn_document', 'cav'].includes(docKey);
          const applicantPrefixes = getApplicantFolderPrefixes(appRow, isAppSpecific);
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
              const matched = azureBlobs.find(b => {
                if (!b.nameLower.startsWith(appPrefix)) return false;
                const relativeName = b.nameLower.slice(appPrefix.length);
                const pattern = folderAlias.replace(/[-_]/g, '[-_]');
                const regex = new RegExp(`(?:^|[/_-])${pattern}(?:$|[/._-])`, 'i');
                return regex.test(relativeName);
              });
              if (matched) return matched;
            }
          }
          // If app-specific doc key (LOI/Sworn Doc), check if any blob explicitly contains application ID
          if (isAppSpecific && (appRow.id || appRow.application_id)) {
            const appIdStr = String(appRow.application_id || appRow.id).toLowerCase();
            const matched = azureBlobs.find(b => {
              const nameLower = b.nameLower;
              return folderAliases.some(alias => nameLower.includes(alias.replace(/_/g, '-')) || nameLower.includes(alias)) &&
                     (nameLower.includes(`_${appIdStr}`) || nameLower.includes(`-${appIdStr}`));
            });
            if (matched) return matched;
          }
          return null;
        };

        documents.forEach(doc => {
          if (doc.existsInAzure) return; // already resolved

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

        console.log(`[Azure Storage] Resolved missing blobs for applicant "${applicantCode}":`, documents.filter(d => d.existsInAzure).map(d => d.key));
      } catch (err) {
        console.error('[Azure Listing Error in getApplicationDocuments]', err.message);
      }
    }
  }

  setCachedDocList(cacheKey, documents);

    res.json({
      success: true,
      divisionStatus: auditLogResult.divisionStatus,
      isClosed: auditLogResult.isClosed,
      cutoffDate: auditLogResult.cutoffDate,
      azureFolder: AZURE_FOLDER_NAME,
      documents
    });
  } catch (error) {
    console.error('Error fetching application documents:', error);
    res.status(500).json({ error: error.message || 'Error fetching application documents' });
  }
}

export async function downloadApplicationDocument(req, res) {
  const { id, key } = req.params;
  if (!id || id === 'undefined' || id === 'null' || id === 'invalid' || !key || key === 'undefined' || key === 'invalid') {
    return res.status(400).json({ error: 'Invalid application ID or document key provided' });
  }
  const AZURE_FOLDER_NAME = process.env.AZURE_FOLDER_NAME || "main-agap";
  const requestedDpi = req.query.dpi || '98';

  res.setHeader('Cache-Control', 'private, max-age=300');

  const containerClient = getAzureContainerClient();

  if (!containerClient) {
    console.log(`[Azure Storage] Connection string not configured. Serving local fallback optimized for ${requestedDpi} DPI.`);
    res.setHeader('Content-Type', 'application/pdf');
    const minimalPdf = Buffer.from(
      'JVBERi0xLjUKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKLVR5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKLVR5cGUgL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4Cj4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIGYgCjAwMDAwMDAyMDEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290 IDEgMCBSCj4+CnN0YXJ0eHJlZgoyNTcKJSVFT0YK',
      'base64'
    );
    return res.send(minimalPdf);
  }

  let auditLogResult = null;
  try {
    const appQuery = await pool.query(
      `SELECT a.id as application_id, a.applicant_id, a.job_cluster_id, a.documents as app_documents, a.letter_of_intent, a.sworn_document, a.sworn_document as sworn_declaration, ap.id as applicant_table_id, ap.applicant_number, ap.code, ap.surname, ap.first_name, ap.other_information, v.id as vacancy_id, v.division, v.status as vacancy_status, v.doc_fetch_preference, v.has_fetched_docs 
       FROM applications a 
       JOIN applicants ap ON a.applicant_id = ap.id 
       LEFT JOIN vacancies v ON (a.job_cluster_id IS NOT NULL AND a.job_cluster_id = v.job_cluster_id)
       WHERE a.id = $1`,
      [id]
    );
    const app = appQuery.rows[0];
    const applicantCode = app ? (app.code || app.applicant_number || app.applicant_id || id) : id;

    auditLogResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: app?.applicant_id,
      applicationId: id,
      vacancyId: app?.vacancy_id,
      jobClusterId: app?.job_cluster_id,
      division: app?.division
    });

    // 1. Direct stream from document_audit_logs new_blob_url / effective_blob_url if matched
    if (auditLogResult?.documents && auditLogResult.documents.length > 0) {
      const mappedTypes = DOCUMENT_TYPE_MAP[key] || [];
      const matchedAudit = auditLogResult.documents.find(a => 
        mappedTypes.some(mt => mt.toLowerCase() === (a.document_type || '').toLowerCase())
      );
      const targetUrl = matchedAudit ? (matchedAudit.new_blob_url || matchedAudit.effective_blob_url || matchedAudit.current_blob_url) : null;
      if (targetUrl) {
        try {
          const u = new URL(targetUrl);
          const parts = u.pathname.replace(/^\//, '').split('/');
          if (parts.length >= 2) {
            const containerName = parts[0];
            const blobPath = parts.slice(1).join('/');
            console.log(`[Azure Storage Direct Stream] 🟢 Found in audit logs -> container: "${containerName}", path: "${blobPath}"`);
            
            const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (connString && connString !== 'ReplaceWithYourAzureStorageConnectionString') {
              const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
              const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobPath);
              const downloadBlockBlobResponse = await blobClient.download(0);

              const chunks = [];
              for await (const chunk of downloadBlockBlobResponse.readableStreamBody) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              const buffer = Buffer.concat(chunks);

              console.log(`[Azure Storage Direct Stream] 🟢 Successfully fetched "${blobPath}" from container "${containerName}". Length: ${buffer.length} bytes.`);
              res.setHeader('Content-Type', downloadBlockBlobResponse.contentType || 'application/pdf');
              res.setHeader('Content-Length', buffer.length);
              res.setHeader('Content-Disposition', `inline; filename="${blobPath.split('/').pop()}"`);
              return res.send(buffer);
            }
          }
        } catch (auditStreamErr) {
          console.error(`[Azure Storage Direct Stream Error]`, auditStreamErr.message);
        }
      }
    }

    let allBlobs = await getBlobsForApplicant(containerClient, app);
    if (auditLogResult.openIntervals && auditLogResult.openIntervals.length > 0) {
      allBlobs = allBlobs.filter(b => b.lastModified ? isUploadedInOpenPeriod(b.lastModified, auditLogResult.openIntervals) : true);
    }
    if (auditLogResult.cutoffDate) {
      const cutoffMs = new Date(auditLogResult.cutoffDate).getTime();
      allBlobs = allBlobs.filter(b => (b.lastModified || 0) <= cutoffMs);
    }
    allBlobs.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

    const extractBlobPath = (urlOrPath) => {
      if (!urlOrPath) return '';
      const cleanUrl = String(urlOrPath).trim();
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        try {
          const u = new URL(cleanUrl);
          let p = decodeURIComponent(u.pathname);
          if (p.startsWith('/')) p = p.slice(1);
          const firstSlashIdx = p.indexOf('/');
          if (firstSlashIdx !== -1) {
            p = p.slice(firstSlashIdx + 1);
          }
          return p;
        } catch (e) {
          return cleanUrl;
        }
      }
      return cleanUrl;
    };

    const findBlob = (appRow) => {

      // 2. Check baseline documents from applicant other_information or app documents
      const otherDocs = appRow?.other_information?.documents || {};
      let parsedAppDocs = {};
      if (appRow?.app_documents) {
        try {
          parsedAppDocs = typeof appRow.app_documents === 'string' ? JSON.parse(appRow.app_documents) : appRow.app_documents;
        } catch (e) {}
      }

      const mappedTypes = DOCUMENT_TYPE_MAP[key] || [key];
      for (const mt of mappedTypes) {
        const baselineUrl = otherDocs[mt] || parsedAppDocs[mt] || parsedAppDocs[key];
        if (baselineUrl && typeof baselineUrl === 'string') {
          const extracted = extractBlobPath(baselineUrl);
          if (extracted) {
            const filenameOnly = extracted.split('/').pop();
            const foundInAzure = allBlobs.find(b => 
              b.name === extracted || 
              b.name.toLowerCase() === extracted.toLowerCase() ||
              b.name.endsWith(extracted) || 
              extracted.endsWith(b.name) ||
              b.name.endsWith(filenameOnly)
            );
            if (foundInAzure) return foundInAzure.name;
            return extracted;
          }
        }
      }

      const isAppSpecific = ['letter_of_intent', 'sworn_declaration', 'sworn_document', 'cav'].includes(key);

      if (key === 'letter_of_intent' && appRow?.letter_of_intent) {
        const extracted = extractBlobPath(appRow.letter_of_intent);
        const found = allBlobs.find(b => b.name === extracted || b.name.endsWith(extracted) || extracted.endsWith(b.name));
        if (found) return found.name;
        return extracted;
      }
      if ((key === 'sworn_declaration' || key === 'cav') && appRow?.sworn_declaration) {
        const extracted = extractBlobPath(appRow.sworn_declaration);
        const found = allBlobs.find(b => b.name === extracted || b.name.endsWith(extracted) || extracted.endsWith(b.name));
        if (found) return found.name;
        return extracted;
      }

      const applicantPrefixes = getApplicantFolderPrefixes(appRow, isAppSpecific);
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
          const matched = allBlobs.find(b => {
            if (!b.nameLower.startsWith(appPrefix)) return false;
            const relativeName = b.nameLower.slice(appPrefix.length);
            const pattern = folderAlias.replace(/[-_]/g, '[-_]');
            const regex = new RegExp(`(?:^|[/_-])${pattern}(?:$|[/._-])`, 'i');
            return regex.test(relativeName);
          });
          if (matched) return matched.name;
        }
      }

      if (isAppSpecific && (appRow.id || appRow.application_id)) {
        const appIdStr = String(appRow.application_id || appRow.id).toLowerCase();
        const matched = allBlobs.find(b => {
          const nameLower = b.nameLower;
          return folderAliases.some(alias => nameLower.includes(alias.replace(/_/g, '-')) || nameLower.includes(alias)) &&
                 (nameLower.includes(`_${appIdStr}`) || nameLower.includes(`-${appIdStr}`));
        });
        if (matched) return matched.name;
      }

      return '';
    };

    const matchedBlobName = findBlob(app);

    if (!matchedBlobName) {
      const availableBlobs = allBlobs.map(b => b.name);
      console.log(`[Azure Storage] Strict match failed for applicant "${applicantCode}". Serving fallback PDF. Scoped blobs:`, availableBlobs);
      res.setHeader('Content-Type', 'application/pdf');
      const minimalPdf = Buffer.from(
        'JVBERi0xLjUKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKLVR5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKLVR5cGUgL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4Cj4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIGYgCjAwMDAwMDAyMDEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290 IDEgMCBSCj4+CnN0YXJ0eHJlZgoyNTcKJSVFT0YK',
        'base64'
      );
      return res.send(minimalPdf);
    }

    console.log(`[Azure Storage] Matches resolved to blob name: "${matchedBlobName}". Downloading...`);
    const blobClient = containerClient.getBlobClient(matchedBlobName);
    const downloadBlockBlobResponse = await blobClient.download(0);
    
    res.setHeader('Content-Type', downloadBlockBlobResponse.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${matchedBlobName}"`);
    
    downloadBlockBlobResponse.readableStreamBody.pipe(res);
  } catch (err) {
    console.error(`[Azure Storage Error] Failed to process blob download for key "${key}":`, err.message);

    // Attempt direct URL fetch fallback if blob URL was found in audit log
    if (auditLogResult?.documents) {
      const mappedTypes = DOCUMENT_TYPE_MAP[key] || [];
      const matchedAudit = auditLogResult.documents.find(a => 
        mappedTypes.some(mt => mt.toLowerCase() === (a.document_type || '').toLowerCase())
      );
      const targetUrl = matchedAudit ? (matchedAudit.effective_blob_url || matchedAudit.current_blob_url || matchedAudit.new_blob_url) : null;
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        try {
          console.log(`[Azure Storage Fallback] Attempting direct fetch from URL: ${targetUrl}`);
          const fetchRes = await fetch(targetUrl);
          if (fetchRes.ok) {
            const arrayBuf = await fetchRes.arrayBuffer();
            const contentType = fetchRes.headers.get('content-type') || 'application/pdf';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${key}.pdf"`);
            return res.send(Buffer.from(arrayBuf));
          }
        } catch (fetchErr) {
          console.error(`[Direct URL Fetch Error]`, fetchErr.message);
        }
      }
    }

    if (err.statusCode === 404 || (err.message && (err.message.includes('does not exist') || err.message.includes('BlobNotFound')))) {
      console.log(`[Azure Storage] Blob missing in Azure container. Serving valid fallback PDF.`);
      res.setHeader('Content-Type', 'application/pdf');
      const minimalPdf = Buffer.from(
        'JVBERi0xLjUKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKLVR5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKLVR5cGUgL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4Cj4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIGYgCjAwMDAwMDAyMDEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290 IDEgMCBSCj4+CnN0YXJ0eHJlZgoyNTcKJSVFT0YK',
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

    const qualifiedStatuses = ['qualified', 'for_comparative_assessment', 'appointed', 'not_appointed', 'ier_posted'];
    list = list.filter(app => {
      const st = String(app.status || '').toLowerCase();
      return qualifiedStatuses.includes(st) || st === 'disqualified';
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

    let posTitle = 'Position';
    let salaryGrade = '—';
    let qsDegree = 'Bachelor\'s Degree relevant to the job';
    let qsTraining = 'None required';
    let qsExperience = 'None required';
    let qsEligibility = 'Career Service (Professional) / Second Level Eligibility';

    if (list.length > 0) {
      const sampleApp = list[0];
      posTitle = sampleApp.vacancy || sampleApp.positionTitle || sampleApp.vacancy_title || 'Position';
      salaryGrade = sampleApp.salaryGrade || sampleApp.salary_grade || '—';
      qsDegree = sampleApp.qsDegree || qsDegree;
      qsTraining = sampleApp.qsTraining || qsTraining;
      qsExperience = sampleApp.qsExperience || qsExperience;
      qsEligibility = sampleApp.qsEligibility || qsEligibility;
    } else if (vacancyId) {
      const { rows: vacRows } = await pool.query(`
        SELECT v.title, v.salary_grade, p.required_bachelor_degree, p.min_years_experience, p.min_training_hours, p.eligibility_required
        FROM vacancies v
        LEFT JOIN positions p ON v.position_id = p.id
        WHERE v.id = $1 OR v.job_cluster_id = $1
        LIMIT 1
      `, [vacancyId]);
      if (vacRows.length > 0) {
        const v = vacRows[0];
        posTitle = v.title || posTitle;
        salaryGrade = v.salary_grade || salaryGrade;
        qsDegree = v.required_bachelor_degree || qsDegree;
        qsTraining = v.min_training_hours ? `${v.min_training_hours} minimum hour(s)` : qsTraining;
        qsExperience = v.min_years_experience ? `${v.min_years_experience} minimum year(s)` : qsExperience;
        qsEligibility = v.eligibility_required || qsEligibility;
      }
    }

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

    setBoldCell('C7', qsDegree);
    setBoldCell('C8', qsTraining);
    setBoldCell('C9', qsExperience);
    setBoldCell('C10', qsEligibility);

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

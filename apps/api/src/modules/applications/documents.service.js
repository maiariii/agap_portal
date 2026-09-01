import { pool } from '../../config/db.js';

/**
 * Maps standard application document keys to document_type labels used in document_audit_logs
 */
export const DOCUMENT_TYPE_MAP = {
  letter_of_intent: ['Letter of Intent'],
  pds: ['Personal Data Sheet', 'Notarized Personal Data Sheet'],
  work_experience: ['Work Experience Sheet'],
  eligibility: ['Certificate of Eligibility', 'Updated PRC License/ID'],
  tor: ['Transcript of Records'],
  prc: ['Updated PRC License/ID', 'Certificate of Eligibility'],
  diploma: ['Diploma (optional)', 'Diploma'],
  resume: ['Resume'],
  coe: ['Service Record / Certificate of Employment', 'Certificate of Employment'],
  outstanding_accomplishments: ['Outstanding Accomplishments'],
  performance_rating: ['Performance Rating'],
  training_certificates: ['Training Certificates'],
  application_education: ['Application of Education'],
  application_learning: ['Application of Learning and Development'],
  sworn_declaration: ['Sworn Declaration'],
  cav: ['Sworn Declaration', 'CAV']
};

/**
 * Determines division status and open posting interval periods for a division.
 * 
 * Rules:
 * - A division is Closed ONLY when every record for that division has a Closed status.
 * - Construct openIntervals array of { start: Date, end: Date } for all open posting windows.
 * 
 * @param {string} divisionName 
 * @returns {Promise<{ divisionStatus: 'Closed'|'Open', isClosed: boolean, openIntervals: Array<{start: Date, end: Date}>, recordsCount: number }>}
 */
/**
 * Determines division status and open posting interval periods for a division / vacancy.
 * 
 * Rules:
 * - A division is Closed when all vacancy records for that division/item have a Closed status.
 * - When Closed: docFetchPreference defaults to 'RETAIN_OLD' (keep existing/current document) unless
 *   the user explicitly selected 'FETCH_NEW' during an open posting.
 * - Under no circumstances does a Closed division automatically fetch newer new_blob_url uploads.
 * 
 * @param {string} [divisionName]
 * @param {string} [vacancyId]
 * @param {string} [jobClusterId]
 * @returns {Promise<{ divisionStatus: 'Closed'|'Open', isClosed: boolean, docFetchPreference: string, hasFetchedDocs: boolean, openIntervals: Array<{start: Date, end: Date}>, recordsCount: number }>}
 */
export async function determineDivisionPeriods(divisionName, vacancyId = null, jobClusterId = null) {
  if (!divisionName && !vacancyId && !jobClusterId) {
    return {
      divisionStatus: 'Closed',
      isClosed: true,
      docFetchPreference: 'RETAIN_OLD',
      hasFetchedDocs: false,
      openIntervals: [],
      recordsCount: 0
    };
  }

  let rows = [];
  if (vacancyId || jobClusterId) {
    const res = await pool.query(
      `SELECT id, status, division, posting_start, posting_end, created_at, updated_at, filling_up_status, doc_fetch_preference, has_fetched_docs, doc_fetched_at 
       FROM vacancies 
       WHERE ($1::text IS NOT NULL AND id = $1)
          OR ($2::text IS NOT NULL AND job_cluster_id = $2)`,
      [vacancyId || null, jobClusterId || null]
    );
    rows = res.rows;
  }
  
  if ((!rows || rows.length === 0) && divisionName) {
    const res = await pool.query(
      `SELECT id, status, division, posting_start, posting_end, created_at, updated_at, filling_up_status, doc_fetch_preference, has_fetched_docs, doc_fetched_at 
       FROM vacancies 
       WHERE UPPER(TRIM(division)) = UPPER(TRIM($1))`,
      [divisionName.trim()]
    );
    rows = res.rows;
  }

  if (!rows || rows.length === 0) {
    return {
      divisionStatus: 'Closed',
      isClosed: true,
      docFetchPreference: 'RETAIN_OLD',
      hasFetchedDocs: false,
      openIntervals: [],
      recordsCount: 0
    };
  }

  const recordsCount = rows.length;
  let openCount = 0;
  let closedCount = 0;
  let openHasFetchNew = false;
  let openHasRetainOld = false;
  let closedHasFetchNew = false;
  let closedHasRetainOld = false;
  let hasFetchedDocs = false;
  let latestDocFetchedAt = null;
  const openIntervals = [];

  for (const row of rows) {
    const statusLower = (row.status || '').toLowerCase();
    const fillingStr = (row.filling_up_status || '').toUpperCase();
    const prefStr = (row.doc_fetch_preference || '').toUpperCase();
    const hasFetched = row.has_fetched_docs === true;

    if (hasFetched || prefStr === 'FETCH_NEW' || prefStr === 'RETAIN_OLD' || row.doc_fetched_at != null) {
      hasFetchedDocs = true;
      if (row.doc_fetched_at) {
        const d = new Date(row.doc_fetched_at);
        if (!latestDocFetchedAt || d.getTime() > latestDocFetchedAt.getTime()) {
          latestDocFetchedAt = d;
        }
      } else if (row.updated_at && statusLower === 'closed') {
        const d = new Date(row.updated_at);
        if (!latestDocFetchedAt || d.getTime() > latestDocFetchedAt.getTime()) {
          latestDocFetchedAt = d;
        }
      }
    }

    if (statusLower === 'open') {
      openCount++;
      if (prefStr === 'FETCH_NEW' && hasFetched) {
        openHasFetchNew = true;
      }
      if (prefStr === 'RETAIN_OLD' || fillingStr.includes('RETAIN_OLD')) {
        openHasRetainOld = true;
      }
    } else {
      closedCount++;
      if ((prefStr === 'FETCH_NEW' || fillingStr.includes('FETCH_NEW')) && hasFetched) {
        closedHasFetchNew = true;
      }
      if (prefStr === 'RETAIN_OLD' || fillingStr.includes('RETAIN_OLD')) {
        closedHasRetainOld = true;
      }
    }

    // Determine the Open posting window for this vacancy record
    const start = row.posting_start
      ? new Date(row.posting_start)
      : new Date(row.created_at || '2000-01-01');

    let end;
    if (row.posting_end) {
      end = new Date(row.posting_end);
    } else if (statusLower === 'open') {
      end = new Date('2099-12-31');
    } else {
      end = new Date(row.updated_at || Date.now());
    }

    // Add valid Open interval only if the record has an open window
    if (statusLower === 'open' || row.posting_start) {
      if (start.getTime() <= end.getTime()) {
        openIntervals.push({ start, end });
      }
    }
  }

  const isClosed = (openCount === 0);
  const divisionStatus = isClosed ? 'Closed' : 'Open';

  let docFetchPreference;

  if (isClosed) {
    // When all vacancies in division are Closed: ALWAYS RETAIN_OLD! Never fetch new documents.
    docFetchPreference = 'RETAIN_OLD';
  } else {
    // When Open:
    // Only use FETCH_NEW if HR explicitly selected FETCH_NEW when opening the vacancy.
    // Otherwise default to RETAIN_OLD.
    if (openHasFetchNew && !openHasRetainOld) {
      docFetchPreference = 'FETCH_NEW';
    } else {
      docFetchPreference = 'RETAIN_OLD';
    }
  }

  let cutoffDate = latestDocFetchedAt;
  if (!cutoffDate && isClosed) {
    const endTimes = openIntervals.map(i => i.end.getTime()).filter(t => t < new Date('2099-01-01').getTime());
    if (endTimes.length > 0) {
      cutoffDate = new Date(Math.max(...endTimes));
    }
  }

  return {
    divisionStatus,
    isClosed,
    docFetchPreference,
    hasFetchedDocs,
    openHasFetchNew,
    closedHasFetchNew,
    cutoffDate,
    openIntervals,
    recordsCount
  };
}

/**
 * Checks if a document upload timestamp fell within an Open period of the division.
 * 
 * @param {Date|string} uploadedAt 
 * @param {Array<{start: Date, end: Date}>} openIntervals 
 * @returns {boolean}
 */
export function isUploadedInOpenPeriod(uploadedAt, openIntervals) {
  if (!uploadedAt) return false;
  if (!openIntervals || openIntervals.length === 0) return false;

  const uploadMs = new Date(uploadedAt).getTime();
  return openIntervals.some(interval => uploadMs >= interval.start.getTime() && uploadMs <= interval.end.getTime());
}

/**
 * Fetches documents from documents_audit_logs for a specific applicant_id,
 * applying upload-time division period rules:
 * - When user clicks 'Fetch All Documents': freezes latest documents as of fetch timestamp.
 * - When vacancy becomes Closed: preserves last fetched documents frozen as final version.
 * - Under no circumstances auto-fetches newer uploads after closing.
 * 
 * @param {Object} params 
 * @param {string|number} params.applicantId 
 * @param {string} [params.applicationId] 
 * @param {string} [params.vacancyId]
 * @param {string} [params.jobClusterId]
 * @param {string} [params.division] 
 * @returns {Promise<{ divisionStatus: string, isClosed: boolean, docFetchPreference: string, documents: Array }>}
 */
export async function fetchApplicantDocumentsFromAuditLogs({ applicantId, applicationId, vacancyId, jobClusterId, division }) {
  let targetApplicantId = applicantId;
  let targetDivision = division;
  let targetVacancyId = vacancyId;
  let targetJobClusterId = jobClusterId;

  console.log(`\n[AuditLog Audit] 🔍 Fetching audit logs for Applicant ID: "${applicantId}", Application ID: "${applicationId}"...`);

  // Resolve missing applicantId or division from application record if needed
  if ((!targetApplicantId || !targetDivision) && applicationId) {
    const appRes = await pool.query(
      `SELECT a.applicant_id, a.job_cluster_id, v.id as vacancy_id, v.division, v.status as vacancy_status, v.doc_fetch_preference, v.has_fetched_docs
       FROM applications a 
       LEFT JOIN vacancies v ON (a.job_cluster_id IS NOT NULL AND a.job_cluster_id = v.job_cluster_id)
       WHERE a.id = $1`,
      [applicationId]
    );
    if (appRes.rows.length > 0) {
      targetApplicantId = targetApplicantId || appRes.rows[0].applicant_id;
      targetDivision = targetDivision || appRes.rows[0].division;
      targetVacancyId = targetVacancyId || appRes.rows[0].vacancy_id;
      targetJobClusterId = targetJobClusterId || appRes.rows[0].job_cluster_id;
    }
  }

  if (!targetApplicantId) {
    console.warn(`[AuditLog Audit] ⚠️ No applicantId resolved. Returning empty document audit logs.`);
    return {
      divisionStatus: 'Closed',
      isClosed: true,
      docFetchPreference: 'RETAIN_OLD',
      hasFetchedDocs: false,
      cutoffDate: null,
      openIntervals: [],
      documents: []
    };
  }

  const divisionInfo = await determineDivisionPeriods(targetDivision, targetVacancyId, targetJobClusterId);

  const { rows } = await pool.query(
    `SELECT 
       id,
       applicant_id,
       application_id,
       document_type,
       new_blob_url,
       batch_number,
       is_open,
       created_at AS uploaded_at
     FROM document_audit_logs
     WHERE applicant_id::text = $1::text
     ORDER BY created_at DESC, id DESC`,
    [String(targetApplicantId)]
  );

  console.log(`\n=================== [AUDIT LOG IS_OPEN & VACANCY CHECK TRACE] ===================`);
  console.log(`[AuditLog Audit] 📥 Target App ID: "${applicationId || 'N/A'}" | Division Status: "${divisionInfo.divisionStatus}" | Cutoff Date: ${divisionInfo.cutoffDate}`);
  console.log(`[AuditLog Audit] 📥 Retrieved ${rows.length} total row(s) from document_audit_logs:`);
  rows.forEach(r => {
    console.log(`  • ID: ${r.id} | AppID: "${r.application_id}" | Document: "${r.document_type}" | Batch: "${r.batch_number}" | is_open: ${r.is_open} | UploadedAt: ${r.uploaded_at}`);
  });
  console.log(`=================================================================================\n`);

  const docGroupMap = new Map();
  rows.forEach(r => {
    const key = (r.document_type || '').toLowerCase().trim();
    if (!docGroupMap.has(key)) {
      docGroupMap.set(key, []);
    }
    docGroupMap.get(key).push(r);
  });

  const processedRows = [];

  docGroupMap.forEach((logs, key) => {
    // Sort logs: Prioritize exact application_id match first, then latest uploaded_at, then higher ID
    logs.sort((a, b) => {
      const aApp = (applicationId && a.application_id && String(a.application_id) === String(applicationId)) ? 1 : 0;
      const bApp = (applicationId && b.application_id && String(b.application_id) === String(applicationId)) ? 1 : 0;
      if (aApp !== bApp) return bApp - aApp;
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime() || b.id - a.id;
    });
    
    // Strict Validation Rule: Check is_open, application_id, and vacancy closed cutoff
    const isRecordOpen = (r) => {
      const isOpenVal = r.is_open;
      const matchesAppId = applicationId && r.application_id && String(r.application_id) === String(applicationId);

      // 1. Exclude explicitly closed / signed-out uploads
      if (isOpenVal === false || isOpenVal === 'false' || isOpenVal === 0) {
        console.log(`   ⛔ Exclude ID ${r.id} ("${r.document_type}"): is_open = ${isOpenVal} (Closed/Signed Out Document)`);
        return false;
      }

      // 2. Closed Vacancy Cutoff Date Check: Exclude uploads created AFTER vacancy closed date unless linked to application_id
      if (divisionInfo.cutoffDate && r.uploaded_at) {
        const uploadTime = new Date(r.uploaded_at).getTime();
        const cutoffTime = new Date(divisionInfo.cutoffDate).getTime();
        if (uploadTime > cutoffTime && !matchesAppId) {
          console.log(`   ⛔ Exclude ID ${r.id} ("${r.document_type}"): Uploaded at ${r.uploaded_at} AFTER closed vacancy cutoff date ${divisionInfo.cutoffDate}`);
          return false;
        }
      }

      // 3. Open posting interval check when vacancy is closed
      if (divisionInfo.isClosed && divisionInfo.openIntervals && divisionInfo.openIntervals.length > 0) {
        const inPeriod = isUploadedInOpenPeriod(r.uploaded_at, divisionInfo.openIntervals);
        if (!inPeriod && !matchesAppId) {
          console.log(`   ⛔ Exclude ID ${r.id} ("${r.document_type}"): Vacancy is CLOSED and document was NOT uploaded in an open posting period`);
          return false;
        }
      }

      if (isOpenVal === true || isOpenVal === 'true' || isOpenVal === 1) {
        console.log(`   ✅ Select ID ${r.id} ("${r.document_type}"): is_open = ${isOpenVal} (Valid Open Document)`);
        return true;
      }

      const isPeriodOpen = isUploadedInOpenPeriod(r.uploaded_at, divisionInfo.openIntervals);
      console.log(`   ℹ️ Check ID ${r.id} ("${r.document_type}"): is_open = null -> Division Open Period check: ${isPeriodOpen}`);
      return isPeriodOpen;
    };

    const targetLog = logs.find(isRecordOpen);

    if (targetLog) {
      const effectiveBlob = targetLog.new_blob_url || null;

      console.log(`[AuditLog Audit] 🎯 Final matched record for "${targetLog.document_type}": ID ${targetLog.id}, batch "${targetLog.batch_number}", is_open: ${targetLog.is_open}, URL: ${effectiveBlob}`);

      processedRows.push({
        ...targetLog,
        current_blob_url: effectiveBlob,
        latest_blob_url: targetLog.new_blob_url || null,
        effective_blob_url: effectiveBlob,
        is_latest: true
      });
    } else {
      console.log(`[AuditLog Audit] ❌ No valid is_open=true record found for document group "${key}" among ${logs.length} logs.`);
    }
  });

  console.log(`[AuditLog Audit] 📋 Returning ${processedRows.length} valid open document(s) to application controller.\n`);

  return {
    divisionStatus: divisionInfo.divisionStatus,
    isClosed: divisionInfo.isClosed,
    docFetchPreference: divisionInfo.docFetchPreference,
    hasFetchedDocs: divisionInfo.hasFetchedDocs,
    cutoffDate: divisionInfo.cutoffDate,
    openIntervals: divisionInfo.openIntervals,
    documents: processedRows
  };
}

/**
 * Helper to insert a batch of uploaded documents into document_audit_logs.
 */
export async function recordDocumentAuditLogBatch({
  applicantId,
  applicationId = null,
  documents = [],
  isOpen = true,
  batchNumber = null
}) {
  if (!applicantId || !documents || documents.length === 0) return [];

  const batch = batchNumber || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const insertedRows = [];

  for (const doc of documents) {
    const { rows } = await pool.query(
      `INSERT INTO document_audit_logs 
         (applicant_id, application_id, document_type, new_blob_url, batch_number, is_open, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        String(applicantId),
        applicationId ? String(applicationId) : null,
        doc.documentType,
        doc.newBlobUrl,
        batch,
        Boolean(isOpen)
      ]
    );
    if (rows.length > 0) insertedRows.push(rows[0]);
  }

  return insertedRows;
}

// Retain alias export for backwards compatibility
export const determineDivisionStatus = determineDivisionPeriods;


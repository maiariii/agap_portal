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
  const openIntervals = [];

  for (const row of rows) {
    const statusLower = (row.status || '').toLowerCase();
    const fillingStr = (row.filling_up_status || '').toUpperCase();
    const prefStr = (row.doc_fetch_preference || '').toUpperCase();
    const hasFetched = row.has_fetched_docs === true;

    if (statusLower === 'open') {
      openCount++;
      if (prefStr === 'FETCH_NEW' || hasFetched) {
        openHasFetchNew = true;
      }
      if (prefStr === 'RETAIN_OLD' || fillingStr.includes('RETAIN_OLD')) {
        openHasRetainOld = true;
      }
    } else {
      closedCount++;
      // A closed vacancy is only considered FETCH_NEW if user explicitly opened with FETCH_NEW and has a valid doc_fetched_at timestamp
      if (prefStr === 'FETCH_NEW' && hasFetched && row.doc_fetched_at != null) {
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
  let hasFetchedDocs;

  if (isClosed) {
    // When Closed: always default to RETAIN_OLD unless explicitly fetched and frozen by user action
    if (closedHasFetchNew && !closedHasRetainOld) {
      docFetchPreference = 'FETCH_NEW';
      hasFetchedDocs = true;
    } else {
      docFetchPreference = 'RETAIN_OLD';
      hasFetchedDocs = false;
    }
  } else {
    // When Open:
    // If explicitly set to RETAIN_OLD (Option B: Retain Current Files), retain old files.
    // Otherwise, Open vacancies default to fetching the latest documents (FETCH_NEW).
    if (openHasRetainOld && !openHasFetchNew) {
      docFetchPreference = 'RETAIN_OLD';
      hasFetchedDocs = false;
    } else {
      docFetchPreference = 'FETCH_NEW';
      hasFetchedDocs = true;
    }
  }

  return {
    divisionStatus,
    isClosed,
    docFetchPreference,
    hasFetchedDocs,
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
 * - When division is Closed: keeps existing/current document and excludes closed-period uploads.
 * - When division is Open: automatically fetches the latest documents (new_blob_url).
 * - When user selects 'Retain Current File' upon reopening: keeps existing document untouched.
 * - When user selects 'Fetch Latest Document' upon reopening: fetches new_blob_url and sets it as current document.
 * - If division is closed again: newly fetched document is frozen and retained without reverting.
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
    return {
      divisionStatus: 'Closed',
      isClosed: true,
      docFetchPreference: 'RETAIN_OLD',
      hasFetchedDocs: false,
      openIntervals: [],
      documents: []
    };
  }

  const divisionInfo = await determineDivisionPeriods(targetDivision, targetVacancyId, targetJobClusterId);

  const { rows } = await pool.query(
    `SELECT 
       id,
       applicant_id,
       document_type,
       old_blob_url,
       new_blob_url,
       affected_applications_count,
       application_id,
       item_no,
       created_at AS uploaded_at
     FROM document_audit_logs
     WHERE applicant_id::text = $1::text
     ORDER BY created_at DESC`,
    [String(targetApplicantId)]
  );

  // Filter for eligibility: documents uploaded while Closed are excluded
  const strictEligibleRows = rows.filter(row => isUploadedInOpenPeriod(row.uploaded_at, divisionInfo.openIntervals));
  const eligibleRows = strictEligibleRows.length > 0 
    ? strictEligibleRows 
    : (divisionInfo.isClosed ? [] : rows);

  // When docFetchPreference is RETAIN_OLD (closed or explicit retain): use old_blob_url
  // When docFetchPreference is FETCH_NEW (open or previously fetched): use new_blob_url
  const useOldBlob = divisionInfo.docFetchPreference === 'RETAIN_OLD';

  const processedRows = eligibleRows.map(r => {
    const latestBlob = r.new_blob_url || r.old_blob_url;
    const currentBlob = useOldBlob
      ? (r.old_blob_url || r.new_blob_url)
      : (r.new_blob_url || r.old_blob_url);

    return {
      ...r,
      current_blob_url: currentBlob,
      latest_blob_url: latestBlob,
      effective_blob_url: currentBlob,
      is_latest: Boolean(currentBlob && latestBlob && currentBlob === latestBlob)
    };
  });

  return {
    divisionStatus: divisionInfo.divisionStatus,
    isClosed: divisionInfo.isClosed,
    docFetchPreference: divisionInfo.docFetchPreference,
    hasFetchedDocs: divisionInfo.hasFetchedDocs,
    openIntervals: divisionInfo.openIntervals,
    documents: processedRows
  };
}

// Retain alias export for backwards compatibility
export const determineDivisionStatus = determineDivisionPeriods;


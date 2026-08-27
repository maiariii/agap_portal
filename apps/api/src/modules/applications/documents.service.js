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
export async function determineDivisionPeriods(divisionName) {
  if (!divisionName) {
    return {
      divisionStatus: 'Open',
      isClosed: false,
      docFetchPreference: 'FETCH_NEW',
      openIntervals: [{ start: new Date(0), end: new Date('2099-12-31') }],
      recordsCount: 0
    };
  }

  const { rows } = await pool.query(
    `SELECT id, status, posting_start, posting_end, created_at, updated_at, filling_up_status 
     FROM vacancies 
     WHERE UPPER(division) = UPPER($1)`,
    [divisionName.trim()]
  );

  if (!rows || rows.length === 0) {
    return {
      divisionStatus: 'Open',
      isClosed: false,
      docFetchPreference: 'FETCH_NEW',
      openIntervals: [{ start: new Date(0), end: new Date('2099-12-31') }],
      recordsCount: 0
    };
  }

  const recordsCount = rows.length;
  let openCount = 0;
  let closedCount = 0;
  let hasRetainOld = false;
  const openIntervals = [];

  for (const row of rows) {
    const statusLower = (row.status || '').toLowerCase();
    if (statusLower === 'open') {
      openCount++;
    } else {
      closedCount++;
    }

    if ((row.filling_up_status || '').includes('RETAIN_OLD')) {
      hasRetainOld = true;
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

    // Add valid Open interval to intervals list
    if (start.getTime() <= end.getTime()) {
      openIntervals.push({ start, end });
    }
  }

  const isClosed = (openCount === 0 && closedCount > 0);
  const divisionStatus = isClosed ? 'Closed' : 'Open';
  const docFetchPreference = hasRetainOld ? 'RETAIN_OLD' : 'FETCH_NEW';

  return {
    divisionStatus,
    isClosed,
    docFetchPreference,
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
  if (!openIntervals || openIntervals.length === 0) return true;

  const uploadMs = new Date(uploadedAt).getTime();
  return openIntervals.some(interval => uploadMs >= interval.start.getTime() && uploadMs <= interval.end.getTime());
}

/**
 * Fetches documents from documents_audit_logs for a specific applicant_id,
 * applying upload-time division period rules:
 * - A document is eligible ONLY if it was uploaded during an Open period (uploaded_at falls within an Open interval).
 * - Documents uploaded/updated during a Closed period remain INELIGIBLE, even if the division is subsequently reopened.
 * - When division is Closed or docFetchPreference === 'RETAIN_OLD': fetch from old_blob_url (fallback to new_blob_url).
 * - When division is Open and docFetchPreference === 'FETCH_NEW': fetch from new_blob_url (fallback to old_blob_url).
 * 
 * @param {Object} params 
 * @param {string|number} params.applicantId 
 * @param {string} [params.applicationId] 
 * @param {string} [params.division] 
 * @returns {Promise<{ divisionStatus: string, isClosed: boolean, documents: Array }>}
 */
export async function fetchApplicantDocumentsFromAuditLogs({ applicantId, applicationId, division }) {
  let targetApplicantId = applicantId;
  let targetDivision = division;

  // Resolve missing applicantId or division from application record if needed
  if ((!targetApplicantId || !targetDivision) && applicationId) {
    const appRes = await pool.query(
      `SELECT a.applicant_id, v.division 
       FROM applications a
       LEFT JOIN vacancies v ON a.job_cluster_id = v.job_cluster_id
       WHERE a.id = $1`,
      [applicationId]
    );
    if (appRes.rows.length > 0) {
      targetApplicantId = targetApplicantId || appRes.rows[0].applicant_id;
      targetDivision = targetDivision || appRes.rows[0].division;
    }
  }

  if (!targetApplicantId) {
    return {
      divisionStatus: 'Open',
      isClosed: false,
      documents: []
    };
  }

  const divisionInfo = await determineDivisionPeriods(targetDivision);

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

  // Filter for eligibility based on upload timestamp vs Open intervals
  const eligibleRows = rows.filter(row => isUploadedInOpenPeriod(row.uploaded_at, divisionInfo.openIntervals));

  // Determine whether to use old_blob_url vs new_blob_url:
  const useOldBlob = divisionInfo.isClosed || divisionInfo.docFetchPreference === 'RETAIN_OLD';

  const processedRows = eligibleRows.map(r => ({
    ...r,
    effective_blob_url: useOldBlob
      ? (r.old_blob_url || r.new_blob_url)
      : (r.new_blob_url || r.old_blob_url)
  }));

  return {
    divisionStatus: divisionInfo.divisionStatus,
    isClosed: divisionInfo.isClosed,
    docFetchPreference: divisionInfo.docFetchPreference,
    openIntervals: divisionInfo.openIntervals,
    documents: processedRows
  };
}

// Retain alias export for backwards compatibility
export const determineDivisionStatus = determineDivisionPeriods;

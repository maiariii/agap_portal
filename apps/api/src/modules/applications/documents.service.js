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
 * Determines the document-fetching behavior based on the status of all records belonging to a division.
 * 
 * Rules:
 * - If ALL records for the division have a Closed status (or non-Open status), division status is 'Closed'.
 * - If ALL records have an Open status, division status is 'Open'.
 * - If a division has a combination of Closed and Open statuses, division status is 'Open'.
 * 
 * @param {string} divisionName 
 * @returns {Promise<{ divisionStatus: 'Closed'|'Open', isClosed: boolean, cutoffDate: Date|null, recordsCount: number, openCount: number, closedCount: number }>}
 */
export async function determineDivisionStatus(divisionName) {
  if (!divisionName) {
    return {
      divisionStatus: 'Open',
      isClosed: false,
      cutoffDate: null,
      recordsCount: 0,
      openCount: 0,
      closedCount: 0
    };
  }

  const { rows } = await pool.query(
    `SELECT id, status, posting_start, posting_end, updated_at 
     FROM vacancies 
     WHERE UPPER(division) = UPPER($1)`,
    [divisionName.trim()]
  );

  if (!rows || rows.length === 0) {
    return {
      divisionStatus: 'Open',
      isClosed: false,
      cutoffDate: null,
      recordsCount: 0,
      openCount: 0,
      closedCount: 0
    };
  }

  const recordsCount = rows.length;
  let openCount = 0;
  let closedCount = 0;
  let maxPostingEnd = null;

  for (const row of rows) {
    const statusLower = (row.status || '').toLowerCase();
    if (statusLower === 'open') {
      openCount++;
    } else {
      closedCount++;
    }

    if (row.posting_end) {
      const endMs = new Date(row.posting_end).getTime();
      if (!maxPostingEnd || endMs > maxPostingEnd.getTime()) {
        maxPostingEnd = new Date(row.posting_end);
      }
    }
  }

  // A division is considered Closed ONLY when every record for that division has a Closed status.
  // If at least one record has an Open status (or a combination of Closed and Open), treat division as Open.
  const isClosed = (openCount === 0 && closedCount > 0);
  const divisionStatus = isClosed ? 'Closed' : 'Open';

  return {
    divisionStatus,
    isClosed,
    cutoffDate: isClosed ? maxPostingEnd : null,
    recordsCount,
    openCount,
    closedCount
  };
}

/**
 * Fetches documents from documents_audit_logs for a specific applicant_id,
 * applying division status rules:
 * - For Closed division (all records Closed): fetch document URL from old_blob_url (fallback to new_blob_url if old_blob_url is null) and restrict upload time.
 * - For Open division (or mixed Closed/Open): fetch document URL from new_blob_url (latest available documents).
 * 
 * @param {Object} params 
 * @param {string|number} params.applicantId 
 * @param {string} [params.applicationId] 
 * @param {string} [params.division] 
 * @returns {Promise<{ divisionStatus: string, isClosed: boolean, cutoffDate: Date|null, documents: Array }>}
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
      cutoffDate: null,
      documents: []
    };
  }

  const divisionInfo = await determineDivisionStatus(targetDivision);

  let query = `
    SELECT 
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
  `;
  const queryParams = [String(targetApplicantId)];

  // Apply upload time restriction for a fully Closed division
  if (divisionInfo.isClosed && divisionInfo.cutoffDate) {
    queryParams.push(divisionInfo.cutoffDate.toISOString());
    query += ` AND created_at <= $2::timestamptz`;
  }

  query += ` ORDER BY created_at DESC`;

  const { rows } = await pool.query(query, queryParams);

  // Attach effective_blob_url based on division status:
  // If Closed: fetch from old_blob_url (fallback to new_blob_url)
  // If Open: fetch from new_blob_url (fallback to old_blob_url)
  const processedRows = rows.map(r => ({
    ...r,
    effective_blob_url: divisionInfo.isClosed
      ? (r.old_blob_url || r.new_blob_url)
      : (r.new_blob_url || r.old_blob_url)
  }));

  return {
    divisionStatus: divisionInfo.divisionStatus,
    isClosed: divisionInfo.isClosed,
    cutoffDate: divisionInfo.cutoffDate,
    documents: processedRows
  };
}

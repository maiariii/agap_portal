import { pool } from '../../config/db.js';

/**
 * Verify whether an applicant email exists in the applicants database.
 * @param {string} email
 * @returns {Promise<{exists: boolean, email: string, applicant: object|null}>}
 */
export async function verifyApplicantEmailInDb(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { exists: false, email: '', applicant: null };
  }

  const { rows } = await pool.query(
    `SELECT id, email_address, CONCAT_WS(' ', NULLIF(first_name, ''), NULLIF(surname, '')) as name 
     FROM applicants 
     WHERE LOWER(TRIM(email_address)) = $1 
     LIMIT 1`,
    [cleanEmail]
  );

  if (rows.length === 0) {
    return { exists: false, email: cleanEmail, applicant: null };
  }
  return { exists: true, email: cleanEmail, applicant: rows[0] };
}

/**
 * Check a list of emails against the applicants table.
 * @param {string[]} emails
 * @returns {Promise<{validEmails: Set<string>, skipped: string[], emailList: string[]}>}
 */
export async function findRegisteredApplicantEmails(emails) {
  const emailList = (Array.isArray(emails) ? emails : [])
    .map(e => String(e || '').trim().toLowerCase())
    .filter(Boolean);

  if (emailList.length === 0) {
    return { validEmails: new Set(), skipped: [], emailList: [] };
  }

  const { rows } = await pool.query(
    `SELECT LOWER(TRIM(email_address)) AS email FROM applicants WHERE LOWER(TRIM(email_address)) = ANY($1)`,
    [emailList]
  );
  const validEmails = new Set(rows.map(r => r.email));
  const skipped = emailList.filter(e => !validEmails.has(e));
  return { validEmails, skipped, emailList };
}

/**
 * Upsert invited applicant emails into the agap_invited tracking table.
 * @param {string[]} validEmailsArray
 * @param {string|null} jobClusterId
 * @returns {Promise<object[]>}
 */
export async function upsertAgapInvitedRecords(validEmailsArray, jobClusterId) {
  const inserted = [];
  for (const email of validEmailsArray) {
    const { rows } = await pool.query(
      `INSERT INTO agap_invited (email, job_cluster_id, created_at, updated_at, is_submitted)
       VALUES ($1, $2, NOW(), NOW(), FALSE)
       ON CONFLICT (email, job_cluster_id)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [email, jobClusterId || null]
    );
    if (rows && rows[0]) {
      inserted.push(rows[0]);
    }
  }
  return inserted;
}

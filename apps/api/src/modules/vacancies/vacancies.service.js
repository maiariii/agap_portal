import { pool } from '../../config/db.js';

/**
 * Verify whether an applicant email exists in the applicants database,
 * and check if they have already submitted an application (where agap_invited.is_submitted = true).
 * @param {string} email
 * @param {string|null} jobClusterId
 * @param {string|null} vacancyId
 * @returns {Promise<{exists: boolean, email: string, applicant: object|null, isSubmitted: boolean, error?: string}>}
 */
export async function verifyApplicantEmailInDb(email, jobClusterId = null, vacancyId = null) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { exists: false, email: '', applicant: null, isSubmitted: false };
  }

  const { rows } = await pool.query(
    `SELECT id, email_address, CONCAT_WS(' ', NULLIF(first_name, ''), NULLIF(surname, '')) as name 
     FROM applicants 
     WHERE LOWER(TRIM(email_address)) = $1 
     LIMIT 1`,
    [cleanEmail]
  );

  if (rows.length === 0) {
    return { exists: false, email: cleanEmail, applicant: null, isSubmitted: false };
  }

  const applicant = rows[0];

  // Check ONLY agap_invited table where is_submitted = true for this job cluster / vacancy
  const submittedSet = await checkSubmittedApplicantEmails([cleanEmail], jobClusterId, vacancyId);
  if (submittedSet.has(cleanEmail)) {
    return {
      exists: true,
      email: cleanEmail,
      applicant: applicant,
      isSubmitted: true,
      error: `Applicant "${cleanEmail}" has already submitted an application for this vacancy and cannot be re-invited.`
    };
  }

  return {
    exists: true,
    email: cleanEmail,
    applicant: applicant,
    isSubmitted: false
  };
}

/**
 * Check which emails among a list have already submitted an application (agap_invited.is_submitted = true).
 * @param {string[]} emails
 * @param {string|null} jobClusterId
 * @param {string|null} vacancyId
 * @returns {Promise<Set<string>>}
 */
export async function checkSubmittedApplicantEmails(emails, jobClusterId = null, vacancyId = null) {
  const emailList = (Array.isArray(emails) ? emails : [])
    .map(e => String(e || '').trim().toLowerCase())
    .filter(Boolean);

  if (emailList.length === 0) return new Set();

  let resolvedClusterId = jobClusterId;
  if (!resolvedClusterId && vacancyId) {
    try {
      const { rows: vacRows } = await pool.query(`SELECT job_cluster_id FROM vacancies WHERE id = $1`, [vacancyId]);
      if (vacRows.length > 0 && vacRows[0].job_cluster_id) {
        resolvedClusterId = vacRows[0].job_cluster_id;
      }
    } catch (e) {
      // ignore
    }
  }

  const submittedSet = new Set();

  // Check ONLY agap_invited table where is_submitted = true
  let invitedQuery = `
    SELECT DISTINCT LOWER(TRIM(email)) as email 
    FROM agap_invited 
    WHERE LOWER(TRIM(email)) = ANY($1) 
      AND is_submitted = TRUE
  `;
  const invitedParams = [emailList];
  if (resolvedClusterId) {
    invitedParams.push(resolvedClusterId);
    invitedQuery += ` AND (job_cluster_id::text = $2::text OR job_cluster_id IS NULL)`;
  }

  try {
    const { rows: invitedRows } = await pool.query(invitedQuery, invitedParams);
    for (const r of invitedRows) {
      if (r.email) submittedSet.add(r.email.toLowerCase());
    }
  } catch (err) {
    console.error('[vacancies.service] Error querying agap_invited for is_submitted:', err.message);
  }

  return submittedSet;
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

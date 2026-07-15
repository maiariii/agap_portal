import { pool } from '../config/db.js';

async function main() {
  try {
    console.log("Reordering applications columns physically...");
    
    // Begin transaction
    await pool.query('BEGIN;');

    // 1. Rename existing table
    await pool.query('ALTER TABLE applications RENAME TO applications_backup;');

    // 2. Drop unique constraint so we can recreate it
    // Foreign keys referencing applications need to be dropped and recreated
    console.log("Dropping foreign key constraints...");
    await pool.query('ALTER TABLE qual_evals DROP CONSTRAINT IF EXISTS qual_evals_application_id_fkey;');
    await pool.query('ALTER TABLE application_history DROP CONSTRAINT IF EXISTS application_history_application_id_fkey;');

    // 3. Recreate the table with application_status right beside status
    console.log("Creating new table with ordered columns...");
    await pool.query(`
      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        application_number TEXT UNIQUE NOT NULL,
        vacancy_id TEXT NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
        applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'Application Submitted',
        application_status TEXT NOT NULL DEFAULT 'Application Submitted',
        date_applied TIMESTAMP NOT NULL,
        documents TEXT NOT NULL DEFAULT '{}',
        documentary_complete BOOLEAN,
        doc_checklist TEXT,
        reason TEXT,
        assessment_status TEXT,
        comparative_assessment_scores TEXT,
        appointment_status TEXT,
        appointment_date TIMESTAMP,
        appointment_item_no TEXT,
        appointment_reference_code TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(applicant_id, vacancy_id)
      );
    `);

    // 4. Restore data from backup table
    console.log("Restoring data to new table...");
    await pool.query(`
      INSERT INTO applications (
        id, application_number, vacancy_id, applicant_id, status, application_status,
        date_applied, documents, documentary_complete, doc_checklist, reason,
        assessment_status, comparative_assessment_scores, appointment_status,
        appointment_date, appointment_item_no, appointment_reference_code,
        created_at, updated_at
      )
      SELECT 
        id, application_number, vacancy_id, applicant_id, status, application_status,
        date_applied, documents, documentary_complete, doc_checklist, reason,
        assessment_status, comparative_assessment_scores, appointment_status,
        appointment_date, appointment_item_no, appointment_reference_code,
        created_at, updated_at
      FROM applications_backup;
    `);

    // 5. Recreate foreign key constraints referencing applications
    console.log("Restoring foreign key constraints...");
    await pool.query('ALTER TABLE qual_evals ADD CONSTRAINT qual_evals_application_id_fkey FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;');
    await pool.query('ALTER TABLE application_history ADD CONSTRAINT application_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;');

    // 6. Drop backup table
    await pool.query('DROP TABLE applications_backup;');

    // Commit transaction
    await pool.query('COMMIT;');
    console.log("Applications columns reordered successfully.");
    process.exit(0);
  } catch (error) {
    await pool.query('ROLLBACK;');
    console.error("Failed to reorder columns:", error);
    process.exit(1);
  }
}

main();

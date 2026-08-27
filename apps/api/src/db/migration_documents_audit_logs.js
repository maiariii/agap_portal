import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring documents_audit_logs view alias exists...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure document_audit_logs table exists or create fallback if missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_audit_logs (
        id SERIAL PRIMARY KEY,
        applicant_id VARCHAR(100),
        document_type VARCHAR(255),
        old_blob_url TEXT,
        new_blob_url TEXT,
        affected_applications_count INTEGER DEFAULT 0,
        application_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        item_no VARCHAR(100)
      );
    `);

    // Create view alias for documents_audit_logs -> document_audit_logs
    await client.query(`
      CREATE OR REPLACE VIEW documents_audit_logs AS 
      SELECT * FROM document_audit_logs;
    `);

    await client.query('COMMIT');
    console.log('[Migration] documents_audit_logs view alias ready!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runMigration().then(() => pool.end());
}

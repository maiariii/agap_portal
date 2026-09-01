import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring document_audit_logs schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure document_audit_logs table exists or create fallback if missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_audit_logs (
        id SERIAL PRIMARY KEY,
        applicant_id VARCHAR(100),
        application_id TEXT,
        document_type VARCHAR(255),
        new_blob_url TEXT,
        batch_number VARCHAR(100),
        is_open BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure columns exist if table was created previously without them
    await client.query(`
      ALTER TABLE document_audit_logs 
      ADD COLUMN IF NOT EXISTS applicant_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS application_id TEXT,
      ADD COLUMN IF NOT EXISTS document_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS new_blob_url TEXT,
      ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // Create view alias for documents_audit_logs -> document_audit_logs
    await client.query(`
      DROP VIEW IF EXISTS documents_audit_logs CASCADE;
      CREATE OR REPLACE VIEW documents_audit_logs AS 
      SELECT * FROM document_audit_logs;
    `);

    await client.query('COMMIT');
    console.log('[Migration] document_audit_logs schema and view ready!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration().then(() => pool.end());
}


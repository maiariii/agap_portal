import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring agap_invited schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create agap_invited table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS agap_invited (
        id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email          TEXT NOT NULL,
        job_cluster_id UUID,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW(),
        is_submitted   BOOLEAN DEFAULT FALSE
      );
    `);

    // 2. Ensure all columns exist in case the table existed previously
    await client.query(`
      ALTER TABLE agap_invited 
        ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS job_cluster_id UUID,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN DEFAULT FALSE;
    `);

    // 3. Ensure unique constraint or index on (email, job_cluster_id)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agap_invited_email_job_cluster 
      ON agap_invited (email, job_cluster_id);
    `);

    // 4. Ensure individual indexes for fast queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agap_invited_email 
      ON agap_invited (email);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agap_invited_job_cluster_id 
      ON agap_invited (job_cluster_id);
    `);

    await client.query('COMMIT');
    console.log('[Migration] agap_invited table and indexes ready!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration()
    .then(() => {
      console.log('Migration script finished.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration execution failed:', err);
      process.exit(1);
    });
}

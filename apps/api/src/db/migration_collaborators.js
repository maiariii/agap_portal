import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring collaborators schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create collaborators table
    await client.query(`
      CREATE TABLE IF NOT EXISTS collaborators (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        position VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        region_id VARCHAR(50) NOT NULL,
        division_id VARCHAR(50) NOT NULL,
        host_hrmo_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns exist if table was partially created
    await client.query(`
      ALTER TABLE collaborators
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS position VARCHAR(255),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS region_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS division_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS host_hrmo_id TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `);

    // Create index on host_hrmo_id for fast lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_collaborators_host_hrmo ON collaborators(host_hrmo_id);
    `);

    // Create index on email
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_collaborators_email ON collaborators(email);
    `);

    await client.query('COMMIT');
    console.log('[Migration] collaborators table and indexes are ready!');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Migration Error - Collaborators]', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration().then(() => pool.end());
}

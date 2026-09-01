import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring doc_fetch_preference, has_fetched_docs, doc_fetched_at columns exist on vacancies...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS doc_fetch_preference TEXT DEFAULT 'RETAIN_OLD';
    `);

    await client.query(`
      ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS has_fetched_docs BOOLEAN DEFAULT FALSE;
    `);

    await client.query(`
      ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS doc_fetched_at TIMESTAMPTZ;
    `);

    // Migrate existing vacancies that explicitly have filling_up_status = 'FETCH_NEW' or doc_fetch_preference = 'FETCH_NEW'
    await client.query(`
      UPDATE vacancies 
      SET has_fetched_docs = TRUE, doc_fetch_preference = 'FETCH_NEW'
      WHERE filling_up_status LIKE '%FETCH_NEW%' OR doc_fetch_preference = 'FETCH_NEW';
    `);

    await client.query('COMMIT');
    console.log('[Migration] Vacancies doc fetch columns ready!');
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



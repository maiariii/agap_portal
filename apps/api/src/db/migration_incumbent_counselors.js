import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring incumbent_guidance_counselors schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create incumbent_guidance_counselors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incumbent_guidance_counselors (
        id SERIAL PRIMARY KEY,
        employee_id TEXT UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        current_position VARCHAR(255) NOT NULL,
        station_division VARCHAR(255) NOT NULL,
        stage_of_reclassification VARCHAR(100) NOT NULL DEFAULT 'For Review',
        target_position VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure all columns exist in case table was pre-existing
    await client.query(`
      ALTER TABLE incumbent_guidance_counselors
      ADD COLUMN IF NOT EXISTS employee_id TEXT,
      ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS current_position VARCHAR(255),
      ADD COLUMN IF NOT EXISTS station_division VARCHAR(255),
      ADD COLUMN IF NOT EXISTS stage_of_reclassification VARCHAR(100) DEFAULT 'For Review',
      ADD COLUMN IF NOT EXISTS target_position VARCHAR(100),
      ADD COLUMN IF NOT EXISTS region VARCHAR(255),
      ADD COLUMN IF NOT EXISTS division VARCHAR(255),
      ADD COLUMN IF NOT EXISTS uacs_oper_dsc TEXT,
      ADD COLUMN IF NOT EXISTS org_cd VARCHAR(100),
      ADD COLUMN IF NOT EXISTS plantilla_item_number VARCHAR(150),
      ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50),
      ADD COLUMN IF NOT EXISTS remarks TEXT,
      ADD COLUMN IF NOT EXISTS dbm_status VARCHAR(100),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 2. Create indexes for quick queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_incumbent_emp_id ON incumbent_guidance_counselors(employee_id);
      CREATE INDEX IF NOT EXISTS idx_incumbent_stage ON incumbent_guidance_counselors(stage_of_reclassification);
      CREATE INDEX IF NOT EXISTS idx_incumbent_item_no ON incumbent_guidance_counselors(plantilla_item_number);
      CREATE INDEX IF NOT EXISTS idx_incumbent_region ON incumbent_guidance_counselors(region);
      CREATE INDEX IF NOT EXISTS idx_incumbent_division ON incumbent_guidance_counselors(division);
    `);

    // 3. Seed records from official CSV if empty or only has test sample
    const checkCount = await client.query('SELECT COUNT(*) FROM incumbent_guidance_counselors');
    if (parseInt(checkCount.rows[0].count, 10) < 100) {
      console.log('[Migration] Importing official Inventory CSV into incumbent_guidance_counselors...');
      const { importInventoryCSV } = await import('./import_gc_csv.js');
      await importInventoryCSV();
    }

    await client.query('COMMIT');
    console.log('[Migration] incumbent_guidance_counselors schema ready!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - Incumbent Guidance Counselors]', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration().then(() => pool.end());
}

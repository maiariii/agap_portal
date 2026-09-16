import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring Teacher Hiring CAR & Plantilla schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Table: car_upload_batches
    await client.query(`
      CREATE TABLE IF NOT EXISTS car_upload_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uploader_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        division VARCHAR(255) NOT NULL,
        file_name VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'processing',
        total_rows INTEGER DEFAULT 0,
        valid_rows INTEGER DEFAULT 0,
        invalid_rows INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Table: car_results
    await client.query(`
      CREATE TABLE IF NOT EXISTS car_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID REFERENCES car_upload_batches(id) ON DELETE CASCADE,
        applicant_code VARCHAR(100) NOT NULL,
        applicant_name VARCHAR(255) NOT NULL,
        item_reference VARCHAR(100) NOT NULL,
        education_score NUMERIC(5,2),
        training_score NUMERIC(5,2),
        experience_score NUMERIC(5,2),
        pbet_score NUMERIC(5,2),
        interview_score NUMERIC(5,2),
        total_rating NUMERIC(5,2) NOT NULL,
        validation_status VARCHAR(20) NOT NULL DEFAULT 'valid',
        validation_errors JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Table: teacher_items (Unfilled Teacher I Plantilla Items)
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_code VARCHAR(100) UNIQUE NOT NULL,
        school_name VARCHAR(255),
        division VARCHAR(255) NOT NULL,
        position_title VARCHAR(100) DEFAULT 'Teacher I',
        is_filled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Table: teacher_appointments (Strict 1-to-1 appointments)
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID REFERENCES car_upload_batches(id) ON DELETE SET NULL,
        car_result_id UUID REFERENCES car_results(id) ON DELETE SET NULL,
        applicant_code VARCHAR(100) NOT NULL,
        applicant_name VARCHAR(255) NOT NULL,
        item_id UUID UNIQUE REFERENCES teacher_items(id) ON DELETE CASCADE,
        appointed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        appointed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Performance Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_car_results_batch_id ON car_results(batch_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_items_division ON teacher_items(division);
      CREATE INDEX IF NOT EXISTS idx_teacher_items_is_filled ON teacher_items(is_filled);
      CREATE INDEX IF NOT EXISTS idx_teacher_appointments_item_id ON teacher_appointments(item_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_appointments_code ON teacher_appointments(applicant_code);
    `);

    // 6. Seed sample unfilled Teacher I items if none exist
    const countRes = await client.query('SELECT COUNT(*) FROM teacher_items');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      console.log('[Migration] Seeding initial Teacher I plantilla items...');
      const seedItems = [
        { item_code: 'T1-NCR-MNL-001', school_name: 'Manila High School', division: 'SDO Manila' },
        { item_code: 'T1-NCR-MNL-002', school_name: 'Araullo High School', division: 'SDO Manila' },
        { item_code: 'T1-NCR-MNL-003', school_name: 'Ramon Magsaysay High School', division: 'SDO Manila' },
        { item_code: 'T1-NCR-QC-001', school_name: 'Quezon City High School', division: 'SDO Quezon City' },
        { item_code: 'T1-NCR-QC-002', school_name: 'Batasan Hills National High School', division: 'SDO Quezon City' },
        { item_code: 'T1-NCR-QC-003', school_name: 'Commonwealth High School', division: 'SDO Quezon City' },
        { item_code: 'T1-NCR-PSG-001', school_name: 'Rizal High School', division: 'SDO Pasig' },
        { item_code: 'T1-NCR-PSG-002', school_name: 'Nagpayong High School', division: 'SDO Pasig' },
        { item_code: 'T1-NCR-CAL-001', school_name: 'Caloocan High School', division: 'SDO Caloocan' },
        { item_code: 'T1-NCR-CAL-002', school_name: 'Bagong Silang High School', division: 'SDO Caloocan' },
        { item_code: 'T1-CO-001', school_name: 'DepEd Central Office Training Lab', division: 'Central Office' },
        { item_code: 'T1-CO-002', school_name: 'National Demonstration High School', division: 'Central Office' },
        { item_code: 'T1-BHROD-001', school_name: 'BHROD Demonstration Center', division: 'BHROD' },
        { item_code: 'T1-BHROD-002', school_name: 'Teacher Development Center', division: 'BHROD' }
      ];

      for (const item of seedItems) {
        await client.query(`
          INSERT INTO teacher_items (item_code, school_name, division, position_title, is_filled)
          VALUES ($1, $2, $3, 'Teacher I', FALSE)
          ON CONFLICT (item_code) DO NOTHING;
        `, [item.item_code, item.school_name, item.division]);
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] Teacher Hiring CAR & Plantilla schema ready!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - Teacher Hiring]', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration().then(() => pool.end());
}

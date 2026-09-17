import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring incumbent_guidance_counselors & incumbent_assessment_data schemas are up to date...');
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
        reclass_position VARCHAR(100),
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
      ADD COLUMN IF NOT EXISTS reclass_position VARCHAR(100),
      ADD COLUMN IF NOT EXISTS region VARCHAR(255),
      ADD COLUMN IF NOT EXISTS division VARCHAR(255),
      ADD COLUMN IF NOT EXISTS uacs_oper_dsc TEXT,
      ADD COLUMN IF NOT EXISTS org_cd VARCHAR(100),
      ADD COLUMN IF NOT EXISTS plantilla_item_number VARCHAR(150),
      ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50),
      ADD COLUMN IF NOT EXISTS remarks TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 2. Create incumbent_assessment_data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incumbent_assessment_data (
        id SERIAL PRIMARY KEY,
        employee_id TEXT UNIQUE NOT NULL REFERENCES incumbent_guidance_counselors(employee_id) ON DELETE CASCADE,
        education TEXT,
        years_experience NUMERIC(5, 2),
        hours_of_training NUMERIC(6, 2),
        eligibility TEXT,
        documents TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE incumbent_assessment_data
      ADD COLUMN IF NOT EXISTS employee_id TEXT,
      ADD COLUMN IF NOT EXISTS education TEXT,
      ADD COLUMN IF NOT EXISTS years_experience NUMERIC(5, 2),
      ADD COLUMN IF NOT EXISTS hours_of_training NUMERIC(6, 2),
      ADD COLUMN IF NOT EXISTS eligibility TEXT,
      ADD COLUMN IF NOT EXISTS documents TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 3. Create indexes for quick queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_incumbent_emp_id ON incumbent_guidance_counselors(employee_id);
      CREATE INDEX IF NOT EXISTS idx_incumbent_stage ON incumbent_guidance_counselors(stage_of_reclassification);
      CREATE INDEX IF NOT EXISTS idx_incumbent_item_no ON incumbent_guidance_counselors(plantilla_item_number);
      CREATE INDEX IF NOT EXISTS idx_incumbent_region ON incumbent_guidance_counselors(region);
      CREATE INDEX IF NOT EXISTS idx_incumbent_division ON incumbent_guidance_counselors(division);
      CREATE INDEX IF NOT EXISTS idx_incumbent_assessment_emp_id ON incumbent_assessment_data(employee_id);
    `);

    // 4. Seed records from official CSV if empty or only has test sample
    const checkCount = await client.query('SELECT COUNT(*) FROM incumbent_guidance_counselors');
    if (parseInt(checkCount.rows[0].count, 10) < 100) {
      console.log('[Migration] Importing official Inventory CSV into incumbent_guidance_counselors...');
      const { importInventoryCSV } = await import('./import_gc_csv.js');
      await importInventoryCSV();
    }

      const sampleIncumbents = [
        {
          employee_id: 'EMP-GC-001',
          full_name: 'Elena R. Bautista',
          current_position: 'Guidance Counselor I',
          station_division: 'SDO Quezon City',
          stage_of_reclassification: 'For Review',
          reclass_position: null,
          assessment: {
            education: 'Master of Arts in Education (Guidance & Counseling) - UP Diliman (36 units completed)',
            years_experience: 4.50,
            hours_of_training: 88.00,
            eligibility: 'RA 1080 (Registered Guidance Counselor) / CSC Professional',
            documents: JSON.stringify([
              { key: 'pds', label: 'Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Transcript of Records (Masteral Units)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'National Counseling Convention Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'PRC Guidance Counselor Board License Card', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ])
          }
        },
        {
          employee_id: 'EMP-GC-002',
          full_name: 'Marco V. Villanueva',
          current_position: 'Guidance Counselor II',
          station_division: 'SDO Manila',
          stage_of_reclassification: 'Endorsed',
          reclass_position: 'School Counselor II',
          assessment: {
            education: 'Master of Arts in Guidance and Counseling (Graduated) - PNU Manila',
            years_experience: 8.00,
            hours_of_training: 140.00,
            eligibility: 'RA 1080 (Registered Guidance Counselor)',
            documents: JSON.stringify([
              { key: 'pds', label: 'Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Masteral Degree TOR & Diploma', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'DepEd SDO Advanced Counseling Workshop', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'PRC Board Certificate & ID Card', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ])
          }
        },
        {
          employee_id: 'EMP-GC-003',
          full_name: 'Corazon D. Mendoza',
          current_position: 'Guidance Counselor III',
          station_division: 'SDO Pasig City',
          stage_of_reclassification: 'Approved',
          reclass_position: 'School Counselor III',
          assessment: {
            education: 'Doctor of Philosophy in Counseling Psychology (CAR) - DLSU; MA Guidance & Counseling',
            years_experience: 12.50,
            hours_of_training: 210.00,
            eligibility: 'RA 1080 (Registered Guidance Counselor) & Career Executive Eligibility',
            documents: JSON.stringify([
              { key: 'pds', label: 'Updated Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Doctorate Coursework & Masteral Transcript of Records', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'National Mental Health & Crisis Intervention Training', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'PRC License & Verification Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ])
          }
        },
        {
          employee_id: 'EMP-GC-004',
          full_name: 'Danilo S. Arboleda',
          current_position: 'Guidance Counselor I',
          station_division: 'SDO Caloocan',
          stage_of_reclassification: 'For Review',
          reclass_position: null,
          assessment: {
            education: 'Bachelor of Science in Psychology; Masteral Units in Counseling (18 units)',
            years_experience: 3.25,
            hours_of_training: 64.00,
            eligibility: 'PBET / LET (Secondary Guidance) & CSC Professional',
            documents: JSON.stringify([
              { key: 'pds', label: 'Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Official Transcript of Records', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'Guidance Counselor Association Seminar Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'Civil Service Commission Eligibility Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ])
          }
        },
        {
          employee_id: 'EMP-GC-005',
          full_name: 'Grace T. Hernandez',
          current_position: 'Guidance Counselor II',
          station_division: 'SDO Taguig-Pateros',
          stage_of_reclassification: 'Denied',
          reclass_position: null,
          assessment: {
            education: 'Bachelor of Arts in Sociology (Lacking required 18 graduate units in guidance & counseling)',
            years_experience: 2.00,
            hours_of_training: 32.00,
            eligibility: 'Civil Service Sub-Professional (Deficient in Board License)',
            documents: JSON.stringify([
              { key: 'pds', label: 'Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Undergraduate Transcript of Records', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'Local Youth Development Training Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ])
          }
        }
      ];

      for (const item of sampleIncumbents) {
        await client.query(`
          INSERT INTO incumbent_guidance_counselors (
            employee_id, full_name, current_position, station_division, stage_of_reclassification, reclass_position
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (employee_id) DO NOTHING;
        `, [
          item.employee_id,
          item.full_name,
          item.current_position,
          item.station_division,
          item.stage_of_reclassification,
          item.reclass_position
        ]);

        await client.query(`
          INSERT INTO incumbent_assessment_data (
            employee_id, education, years_experience, hours_of_training, eligibility, documents
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (employee_id) DO NOTHING;
        `, [
          item.employee_id,
          item.assessment.education,
          item.assessment.years_experience,
          item.assessment.hours_of_training,
          item.assessment.eligibility,
          item.assessment.documents
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] incumbent_guidance_counselors & incumbent_assessment_data schema ready!');
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

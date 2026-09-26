import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring reclassification_application schema is up to date (13 fields)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS reclassification_application (
        id SERIAL PRIMARY KEY,
        application_number VARCHAR(100) UNIQUE NOT NULL,
        applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
        region VARCHAR(100),
        division VARCHAR(255),
        school_id VARCHAR(50),
        position_title VARCHAR(255) NOT NULL,
        current_item_number VARCHAR(100),
        qs_status VARCHAR(100) DEFAULT 'Pending Review',
        indicative_position VARCHAR(255),
        actual_position VARCHAR(255),
        new_item_number VARCHAR(100),
        stage_of_reclassification VARCHAR(100) DEFAULT 'For Review',
        documents JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE reclassification_application ADD COLUMN IF NOT EXISTS id SERIAL;
      ALTER TABLE reclassification_application ADD COLUMN IF NOT EXISTS incumbent_id INTEGER REFERENCES incumbent_guidance_counselors(id) ON DELETE SET NULL;
      ALTER TABLE reclassification_application ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE reclassification_application ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      -- Ensure incumbent_guidance_counselors has reclass_position, actual_position, and new_item_number
      ALTER TABLE incumbent_guidance_counselors ADD COLUMN IF NOT EXISTS reclass_position VARCHAR(255);
      ALTER TABLE incumbent_guidance_counselors ADD COLUMN IF NOT EXISTS actual_position VARCHAR(255);
      ALTER TABLE incumbent_guidance_counselors ADD COLUMN IF NOT EXISTS new_item_number VARCHAR(100);
    `);

    // Indexes for fast lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_app_num ON reclassification_application(application_number);
      CREATE INDEX IF NOT EXISTS idx_reclass_applicant_id ON reclassification_application(applicant_id);
      CREATE INDEX IF NOT EXISTS idx_reclass_incumbent_id ON reclassification_application(incumbent_id);
      CREATE INDEX IF NOT EXISTS idx_reclass_item_no ON reclassification_application(current_item_number);
      CREATE INDEX IF NOT EXISTS idx_incumbent_reclass_pos ON incumbent_guidance_counselors(reclass_position);
    `);

    // Link existing applications with incumbent_guidance_counselors by item number or employee ID
    await client.query(`
      UPDATE reclassification_application ra
      SET incumbent_id = igc.id
      FROM incumbent_guidance_counselors igc
      WHERE ra.incumbent_id IS NULL
        AND (
          (ra.current_item_number IS NOT NULL AND (TRIM(LOWER(ra.current_item_number)) = TRIM(LOWER(igc.plantilla_item_number)) OR TRIM(LOWER(ra.current_item_number)) = TRIM(LOWER(igc.employee_id))))
          OR (ra.new_item_number IS NOT NULL AND TRIM(LOWER(ra.new_item_number)) = TRIM(LOWER(igc.plantilla_item_number)))
        );

      -- Backfill actual_position, new_item_number, and reclass_position between connected records
      UPDATE incumbent_guidance_counselors igc
      SET actual_position = COALESCE(ra.actual_position, igc.actual_position, igc.reclass_position, igc.target_position),
          reclass_position = COALESCE(ra.actual_position, igc.reclass_position, igc.actual_position, igc.target_position),
          target_position = COALESCE(ra.actual_position, igc.target_position),
          new_item_number = COALESCE(ra.new_item_number, igc.new_item_number)
      FROM reclassification_application ra
      WHERE ra.incumbent_id = igc.id
         OR (ra.current_item_number IS NOT NULL AND (TRIM(LOWER(ra.current_item_number)) = TRIM(LOWER(igc.plantilla_item_number)) OR TRIM(LOWER(ra.current_item_number)) = TRIM(LOWER(igc.employee_id))));

      UPDATE incumbent_guidance_counselors
      SET reclass_position = COALESCE(actual_position, reclass_position, target_position)
      WHERE reclass_position IS NULL AND (actual_position IS NOT NULL OR target_position IS NOT NULL);
    `);

    // Ensure database-level synchronization triggers for stage, actual_position, and new_item_number
    await client.query(`
      CREATE OR REPLACE FUNCTION sync_incumbent_to_application()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (pg_trigger_depth() <= 1) THEN
          UPDATE reclassification_application
          SET stage_of_reclassification = NEW.stage_of_reclassification,
              actual_position = COALESCE(NEW.actual_position, NEW.reclass_position, NEW.target_position, actual_position),
              new_item_number = COALESCE(NEW.new_item_number, new_item_number),
              updated_at = NOW()
          WHERE incumbent_id = NEW.id
             OR (current_item_number IS NOT NULL AND (TRIM(LOWER(current_item_number)) = TRIM(LOWER(NEW.plantilla_item_number)) OR TRIM(LOWER(current_item_number)) = TRIM(LOWER(NEW.employee_id))))
             OR (new_item_number IS NOT NULL AND TRIM(LOWER(new_item_number)) = TRIM(LOWER(NEW.plantilla_item_number)));
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_incumbent_stage ON incumbent_guidance_counselors;
      DROP TRIGGER IF EXISTS trg_sync_incumbent_to_app ON incumbent_guidance_counselors;
      CREATE TRIGGER trg_sync_incumbent_to_app
      AFTER UPDATE OF stage_of_reclassification, target_position, reclass_position, actual_position, new_item_number ON incumbent_guidance_counselors
      FOR EACH ROW
      WHEN (
        OLD.stage_of_reclassification IS DISTINCT FROM NEW.stage_of_reclassification
        OR OLD.target_position IS DISTINCT FROM NEW.target_position
        OR OLD.reclass_position IS DISTINCT FROM NEW.reclass_position
        OR OLD.actual_position IS DISTINCT FROM NEW.actual_position
        OR OLD.new_item_number IS DISTINCT FROM NEW.new_item_number
      )
      EXECUTE FUNCTION sync_incumbent_to_application();

      CREATE OR REPLACE FUNCTION sync_application_to_incumbent()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (pg_trigger_depth() <= 1) THEN
          UPDATE incumbent_guidance_counselors
          SET stage_of_reclassification = NEW.stage_of_reclassification,
              actual_position = COALESCE(NEW.actual_position, actual_position),
              reclass_position = COALESCE(NEW.actual_position, reclass_position),
              target_position = COALESCE(NEW.actual_position, target_position),
              new_item_number = COALESCE(NEW.new_item_number, new_item_number),
              updated_at = NOW()
          WHERE (NEW.incumbent_id IS NOT NULL AND id = NEW.incumbent_id)
             OR (NEW.current_item_number IS NOT NULL AND (TRIM(LOWER(plantilla_item_number)) = TRIM(LOWER(NEW.current_item_number)) OR TRIM(LOWER(employee_id)) = TRIM(LOWER(NEW.current_item_number))));
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_application_stage ON reclassification_application;
      DROP TRIGGER IF EXISTS trg_sync_app_to_incumbent ON reclassification_application;
      CREATE TRIGGER trg_sync_app_to_incumbent
      AFTER UPDATE OF stage_of_reclassification, actual_position, new_item_number ON reclassification_application
      FOR EACH ROW
      WHEN (
        OLD.stage_of_reclassification IS DISTINCT FROM NEW.stage_of_reclassification
        OR OLD.actual_position IS DISTINCT FROM NEW.actual_position
        OR OLD.new_item_number IS DISTINCT FROM NEW.new_item_number
      )
      EXECUTE FUNCTION sync_application_to_incumbent();
    `);

    // Ensure backward compatible view
    await client.query(`
      CREATE OR REPLACE VIEW reclassification_applications AS 
      SELECT * FROM reclassification_application;
    `);

    // Seed initial records if empty
    const checkCount = await client.query('SELECT COUNT(*) FROM reclassification_application');
    if (parseInt(checkCount.rows[0].count, 10) === 0) {
      console.log('[Migration] Seeding initial demonstration reclassification applications...');
      
      const applicantsResult = await client.query('SELECT id FROM applicants ORDER BY id ASC LIMIT 5');
      const existingApplicantIds = applicantsResult.rows.map(r => r.id);

      const sampleData = [
        {
          applicant_id: existingApplicantIds[0] || null,
          application_number: 'REC-2026-001',
          region: 'National Capital Region (NCR)',
          division: 'SDO Quezon City',
          school_id: '300101',
          position_title: 'Master Teacher I (Secondary)',
          current_item_number: 'OSEC-DECSB-MTCHR1-00192',
          qs_status: 'Qualified (CSC QS)',
          indicative_position: 'Master Teacher I (Secondary)',
          actual_position: 'Master Teacher I (Secondary)',
          new_item_number: null,
          stage_of_reclassification: 'For Review',
          documents: JSON.stringify([
            { name: 'Updated_PDS_2026.pdf', type: 'pds', uploadedAt: '2026-02-10T14:15:00+08:00' },
            { name: 'IPCRF_Outstanding_2025.pdf', type: 'ipcrf', uploadedAt: '2026-02-10T14:15:00+08:00' }
          ])
        },
        {
          applicant_id: existingApplicantIds[1] || null,
          application_number: 'REC-2026-002',
          region: 'National Capital Region (NCR)',
          division: 'SDO Manila',
          school_id: '300102',
          position_title: 'Head Teacher III',
          current_item_number: 'OSEC-DECSB-HTEACH3-00084',
          qs_status: 'Pending Review',
          indicative_position: 'Head Teacher III',
          actual_position: 'Head Teacher III',
          new_item_number: null,
          stage_of_reclassification: 'Endorsed to RO',
          documents: JSON.stringify([
            { name: 'PDS_Original_Submission.pdf', type: 'pds', uploadedAt: '2026-01-22T10:00:00+08:00' }
          ])
        },
        {
          applicant_id: existingApplicantIds[2] || null,
          application_number: 'REC-2026-003',
          region: 'National Capital Region (NCR)',
          division: 'SDO Pasig',
          school_id: '300103',
          position_title: 'Special Education Teacher I',
          current_item_number: 'OSEC-DECSB-SPET1-00215',
          qs_status: 'Needs Applicant Update',
          indicative_position: 'Special Education Teacher I',
          actual_position: 'Special Education Teacher I',
          new_item_number: null,
          stage_of_reclassification: 'Endorsed to SDO',
          documents: JSON.stringify([])
        }
      ];

      for (const item of sampleData) {
        await client.query(`
          INSERT INTO reclassification_application (
            applicant_id, application_number, region, division, school_id,
            position_title, current_item_number, qs_status, indicative_position,
            actual_position, new_item_number, stage_of_reclassification, documents
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
          ON CONFLICT (application_number) DO NOTHING;
        `, [
          item.applicant_id,
          item.application_number,
          item.region,
          item.division,
          item.school_id,
          item.position_title,
          item.current_item_number,
          item.qs_status,
          item.indicative_position,
          item.actual_position,
          item.new_item_number,
          item.stage_of_reclassification,
          item.documents
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] reclassification_application schema (13 fields) ready!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - Reclassification]', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration().then(() => pool.end());
}

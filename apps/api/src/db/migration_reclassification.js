import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring reclassification_applications schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS reclassification_applications (
        id SERIAL PRIMARY KEY,
        application_number VARCHAR(100) UNIQUE NOT NULL,
        applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
        employee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        position_title VARCHAR(255) NOT NULL,
        item_number VARCHAR(100),
        station_division VARCHAR(255),
        date_originally_submitted TIMESTAMPTZ DEFAULT NOW(),
        proposed_qs_eval_result VARCHAR(100),
        csc_approved_qs_eval_result VARCHAR(100),
        evaluation_status VARCHAR(50) DEFAULT 'pending_reevaluation',
        has_updated_credentials BOOLEAN DEFAULT FALSE,
        updated_credentials_submitted_at TIMESTAMPTZ,
        documents JSONB DEFAULT '[]'::jsonb,
        reevaluation_timestamp TIMESTAMPTZ,
        dbm_export_timestamp TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure all columns exist in case table was created with earlier partial schema
    await client.query(`
      ALTER TABLE reclassification_applications
      ADD COLUMN IF NOT EXISTS application_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS applicant_id INTEGER,
      ADD COLUMN IF NOT EXISTS employee_id TEXT,
      ADD COLUMN IF NOT EXISTS position_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS item_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS station_division VARCHAR(255),
      ADD COLUMN IF NOT EXISTS date_originally_submitted TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS proposed_qs_eval_result VARCHAR(100),
      ADD COLUMN IF NOT EXISTS csc_approved_qs_eval_result VARCHAR(100),
      ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(50) DEFAULT 'pending_reevaluation',
      ADD COLUMN IF NOT EXISTS has_updated_credentials BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS updated_credentials_submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS reevaluation_timestamp TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dbm_export_timestamp TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // Indexes for fast lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_app_num ON reclassification_applications(application_number);
      CREATE INDEX IF NOT EXISTS idx_reclass_eval_status ON reclassification_applications(evaluation_status);
      CREATE INDEX IF NOT EXISTS idx_reclass_applicant_id ON reclassification_applications(applicant_id);
    `);

    // Seed initial records if empty
    const checkCount = await client.query('SELECT COUNT(*) FROM reclassification_applications');
    if (parseInt(checkCount.rows[0].count, 10) === 0) {
      console.log('[Migration] Seeding initial demonstration reclassification applications...');
      
      // Look up any existing applicants to link
      const applicantsResult = await client.query('SELECT id FROM applicants ORDER BY id ASC LIMIT 5');
      const existingApplicantIds = applicantsResult.rows.map(r => r.id);

      const sampleData = [
        {
          application_number: 'REC-2026-001',
          applicant_id: existingApplicantIds[0] || null,
          position_title: 'Master Teacher I (Secondary)',
          item_number: 'OSEC-DECSB-MTCHR1-00192',
          station_division: 'SDO Quezon City',
          date_originally_submitted: new Date('2026-01-15T08:30:00+08:00'),
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Qualified (CSC QS)',
          evaluation_status: 'reevaluated',
          has_updated_credentials: true,
          updated_credentials_submitted_at: new Date('2026-02-10T14:15:00+08:00'),
          documents: JSON.stringify([
            { name: 'Updated_PDS_2026.pdf', type: 'pds', uploadedAt: '2026-02-10T14:15:00+08:00' },
            { name: 'IPCRF_Outstanding_2025.pdf', type: 'ipcrf', uploadedAt: '2026-02-10T14:15:00+08:00' }
          ]),
          reevaluation_timestamp: new Date('2026-02-14T10:00:00+08:00'),
          dbm_export_timestamp: new Date('2026-03-01T09:00:00+08:00')
        },
        {
          application_number: 'REC-2026-002',
          applicant_id: existingApplicantIds[1] || null,
          position_title: 'Head Teacher III',
          item_number: 'OSEC-DECSB-HTEACH3-00084',
          station_division: 'SDO Manila',
          date_originally_submitted: new Date('2026-01-22T10:00:00+08:00'),
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Pending CSC Review',
          evaluation_status: 'pending_reevaluation',
          has_updated_credentials: false,
          updated_credentials_submitted_at: null,
          documents: JSON.stringify([
            { name: 'PDS_Original_Submission.pdf', type: 'pds', uploadedAt: '2026-01-22T10:00:00+08:00' }
          ]),
          reevaluation_timestamp: null,
          dbm_export_timestamp: null
        },
        {
          application_number: 'REC-2026-003',
          applicant_id: existingApplicantIds[2] || null,
          position_title: 'Special Education Teacher I',
          item_number: 'OSEC-DECSB-SPET1-00215',
          station_division: 'SDO Pasig',
          date_originally_submitted: new Date('2026-02-01T11:45:00+08:00'),
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Needs Applicant Update',
          evaluation_status: 'needs_applicant_update',
          has_updated_credentials: false,
          updated_credentials_submitted_at: null,
          documents: JSON.stringify([]),
          reevaluation_timestamp: new Date('2026-02-18T16:20:00+08:00'),
          dbm_export_timestamp: null
        },
        {
          application_number: 'REC-2026-004',
          applicant_id: existingApplicantIds[3] || null,
          position_title: 'Master Teacher II',
          item_number: 'OSEC-DECSB-MTCHR2-00041',
          station_division: 'SDO Caloocan',
          date_originally_submitted: new Date('2026-02-05T09:15:00+08:00'),
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Qualified (CSC QS)',
          evaluation_status: 'reevaluated',
          has_updated_credentials: true,
          updated_credentials_submitted_at: new Date('2026-02-25T11:30:00+08:00'),
          documents: JSON.stringify([
            { name: 'MA_Diploma_Transcript.pdf', type: 'tor', uploadedAt: '2026-02-25T11:30:00+08:00' }
          ]),
          reevaluation_timestamp: new Date('2026-02-28T13:40:00+08:00'),
          dbm_export_timestamp: null
        }
      ];

      for (const item of sampleData) {
        await client.query(`
          INSERT INTO reclassification_applications (
            application_number, applicant_id, position_title, item_number, station_division,
            date_originally_submitted, proposed_qs_eval_result, csc_approved_qs_eval_result,
            evaluation_status, has_updated_credentials, updated_credentials_submitted_at,
            documents, reevaluation_timestamp, dbm_export_timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
          ON CONFLICT (application_number) DO NOTHING;
        `, [
          item.application_number,
          item.applicant_id,
          item.position_title,
          item.item_number,
          item.station_division,
          item.date_originally_submitted,
          item.proposed_qs_eval_result,
          item.csc_approved_qs_eval_result,
          item.evaluation_status,
          item.has_updated_credentials,
          item.updated_credentials_submitted_at,
          item.documents,
          item.reevaluation_timestamp,
          item.dbm_export_timestamp
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] reclassification_applications schema ready!');
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

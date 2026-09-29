import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring NOSCA documents and SDO tracking schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create reclassification_nosca_documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reclassification_nosca_documents (
        id SERIAL PRIMARY KEY,
        serial_no VARCHAR(100),
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT,
        file_data TEXT,
        file_size BIGINT,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        division VARCHAR(255),
        school_id VARCHAR(50),
        school_name VARCHAR(255),
        position_title VARCHAR(255) DEFAULT 'School Counselor Associate I',
        total_items INTEGER DEFAULT 0,
        assigned_count INTEGER DEFAULT 0,
        uploaded_by VARCHAR(255) DEFAULT 'Regional Office',
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    // 2. Add NOSCA tracking columns to incumbent_guidance_counselors
    await client.query(`
      ALTER TABLE incumbent_guidance_counselors
      ADD COLUMN IF NOT EXISTS new_item_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS nosca_serial_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS nosca_file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS nosca_file_url TEXT,
      ADD COLUMN IF NOT EXISTS nosca_uploaded_at TIMESTAMPTZ;
    `);

    // 3. Ensure reclassification_application also has new_item_number and nosca references
    await client.query(`
      ALTER TABLE reclassification_application
      ADD COLUMN IF NOT EXISTS new_item_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS nosca_serial_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS nosca_file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS nosca_uploaded_at TIMESTAMPTZ;
    `);

    // 4. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_incumbent_new_item_no ON incumbent_guidance_counselors(new_item_number);
      CREATE INDEX IF NOT EXISTS idx_incumbent_nosca_serial ON incumbent_guidance_counselors(nosca_serial_no);
      CREATE INDEX IF NOT EXISTS idx_nosca_docs_serial ON reclassification_nosca_documents(serial_no);
    `);

    // 5. Seed test/sample personnel with 'Endorsed to SDO' if none exist, so the user can immediately experience the tab!
    const sdoCountRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM incumbent_guidance_counselors 
      WHERE stage_of_reclassification = 'Endorsed to SDO';
    `);

    if (parseInt(sdoCountRes.rows[0].count, 10) === 0) {
      console.log('[Migration] Promoting sample incumbents to "Endorsed to SDO" for immediate tracking demo...');
      
      // Select 6 filled candidates across different divisions
      const candidates = await client.query(`
        SELECT id, full_name, division, station_division
        FROM incumbent_guidance_counselors
        WHERE full_name != '#N/A' AND full_name IS NOT NULL
        LIMIT 6;
      `);

      if (candidates.rows.length > 0) {
        // First 3: Endorsed to SDO with NOSCA already uploaded & new item assigned
        // Next 3: Endorsed to SDO with NOSCA pending upload
        for (let i = 0; i < candidates.rows.length; i++) {
          const row = candidates.rows[i];
          const hasNosca = i < 3;
          const newItemNo = hasNosca ? `OSEC-DECSB-SCA1-${300010 + i}-2024` : null;
          const serialNo = hasNosca ? 'RO-NCR-2024-089' : null;
          const fileName = hasNosca ? 'NOSCA_NCR_2024_089.pdf' : null;

          await client.query(`
            UPDATE incumbent_guidance_counselors
            SET stage_of_reclassification = 'Endorsed to SDO',
                target_position = 'School Counselor Associate I',
                actual_position = 'School Counselor Associate I',
                reclass_position = 'School Counselor Associate I',
                new_item_number = $1,
                nosca_serial_no = $2,
                nosca_file_name = $3,
                nosca_uploaded_at = $4,
                dbm_status = $5
            WHERE id = $6;
          `, [
            newItemNo,
            serialNo,
            fileName,
            hasNosca ? new Date() : null,
            hasNosca ? 'With DBM NOSCA' : 'With DBM Request',
            row.id
          ]);

          // Also insert into reclassification_nosca_items for the assigned ones
          if (hasNosca) {
            await client.query(`
              INSERT INTO reclassification_nosca_items (
                serial_no,
                plantilla_item_number,
                category,
                position_title,
                division,
                school_name,
                source_type,
                file_name,
                assignment_status,
                assigned_to_incumbent_id,
                assigned_to_employee_id,
                assigned_at
              ) VALUES ($1, $2, 'ELEMENTARY', 'School Counselor Associate I', $3, $4, 'pdf_scan', $5, 'ASSIGNED', $6, $7, NOW())
              ON CONFLICT DO NOTHING;
            `, [
              serialNo,
              newItemNo,
              row.division || 'SDO Manila',
              row.station_division || 'SDO Station',
              fileName,
              row.id,
              `EMP-${row.id}`
            ]);
          }
        }

        // Insert a sample document record in reclassification_nosca_documents
        await client.query(`
          INSERT INTO reclassification_nosca_documents (
            serial_no,
            file_name,
            file_url,
            division,
            total_items,
            assigned_count,
            uploaded_by,
            uploaded_at
          ) VALUES (
            'RO-NCR-2024-089',
            'NOSCA_NCR_2024_089.pdf',
            'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
            'National Capital Region',
            3,
            3,
            'Regional Director (RO NCR)',
            NOW()
          );
        `);
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] NOSCA documents and SDO tracking schema created successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Error migrating NOSCA documents schema:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('migration_nosca_documents.js')) {
  runMigration()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}

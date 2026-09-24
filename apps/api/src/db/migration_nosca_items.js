import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring reclassification_nosca_items schema is up to date...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create reclassification_nosca_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reclassification_nosca_items (
        id SERIAL PRIMARY KEY,
        serial_no VARCHAR(100),
        plantilla_item_number VARCHAR(150) NOT NULL,
        category VARCHAR(50) DEFAULT 'ELEMENTARY',
        position_title VARCHAR(255) DEFAULT 'School Counselor Associate I',
        division VARCHAR(255),
        school_id VARCHAR(50),
        school_name VARCHAR(255),
        source_type VARCHAR(50) DEFAULT 'pdf_scan',
        file_name VARCHAR(255),
        assignment_status VARCHAR(50) DEFAULT 'AVAILABLE',
        assigned_to_incumbent_id INTEGER REFERENCES incumbent_guidance_counselors(id) ON DELETE SET NULL,
        assigned_to_employee_id TEXT,
        assigned_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure all columns exist in case table was pre-existing
    await client.query(`
      ALTER TABLE reclassification_nosca_items
      ADD COLUMN IF NOT EXISTS serial_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS plantilla_item_number VARCHAR(150),
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'ELEMENTARY',
      ADD COLUMN IF NOT EXISTS position_title VARCHAR(255) DEFAULT 'School Counselor Associate I',
      ADD COLUMN IF NOT EXISTS division VARCHAR(255),
      ADD COLUMN IF NOT EXISTS school_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS school_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'pdf_scan',
      ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) DEFAULT 'AVAILABLE',
      ADD COLUMN IF NOT EXISTS assigned_to_incumbent_id INTEGER,
      ADD COLUMN IF NOT EXISTS assigned_to_employee_id TEXT,
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 2. Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nosca_items_item_no ON reclassification_nosca_items(plantilla_item_number);
      CREATE INDEX IF NOT EXISTS idx_nosca_items_serial ON reclassification_nosca_items(serial_no);
      CREATE INDEX IF NOT EXISTS idx_nosca_items_status ON reclassification_nosca_items(assignment_status);
      CREATE INDEX IF NOT EXISTS idx_nosca_items_assigned ON reclassification_nosca_items(assigned_to_incumbent_id);
    `);

    // 3. Migrate any previous dummy placeholder items from incumbent_guidance_counselors
    const existingPlaceholders = await client.query(`
      SELECT id, plantilla_item_number, division, uacs_oper_dsc, remarks, target_position
      FROM incumbent_guidance_counselors
      WHERE full_name = 'UNFILLED ITEM (NOSCA)'
    `);

    if (existingPlaceholders.rows.length > 0) {
      console.log(`[Migration] Migrating ${existingPlaceholders.rows.length} existing placeholder rows to reclassification_nosca_items...`);
      for (const row of existingPlaceholders.rows) {
        if (!row.plantilla_item_number) continue;
        const serialMatch = (row.remarks || '').match(/NOSCA Ref:\s*([^\s|]+)|NOSCA Serial:\s*([^\s|]+)/i);
        const serial = serialMatch ? (serialMatch[1] || serialMatch[2]) : 'PREV-NOSCA';

        await client.query(`
          INSERT INTO reclassification_nosca_items (
            serial_no,
            plantilla_item_number,
            position_title,
            division,
            school_name,
            source_type,
            assignment_status
          ) VALUES ($1, $2, $3, $4, $5, 'pdf_scan', 'AVAILABLE')
          ON CONFLICT DO NOTHING
        `, [
          serial,
          row.plantilla_item_number,
          row.target_position || 'School Counselor Associate I',
          row.division || 'Regional Office',
          row.uacs_oper_dsc || 'Regional Allocation Station'
        ]);
      }

      // Delete the dummy placeholder rows from human incumbents table
      await client.query(`
        DELETE FROM incumbent_guidance_counselors
        WHERE full_name = 'UNFILLED ITEM (NOSCA)'
      `);
      console.log(`[Migration] Successfully cleaned dummy records from incumbent_guidance_counselors.`);
    }

    await client.query('COMMIT');
    console.log('[Migration] reclassification_nosca_items table is ready!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed to setup reclassification_nosca_items table:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct execution
if (process.argv[1]?.includes('migration_nosca_items')) {
  runMigration()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

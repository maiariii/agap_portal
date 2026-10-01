import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Renaming reclassification_nosca_items to reclass_new_item_no...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if reclassification_nosca_items exists as a base table
    const checkOldRes = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'reclassification_nosca_items';
    `);

    // Check if reclass_new_item_no exists
    const checkNewRes = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'reclass_new_item_no';
    `);

    const oldTable = checkOldRes.rows[0];
    const newTable = checkNewRes.rows[0];

    if (oldTable && oldTable.table_type === 'BASE TABLE') {
      if (!newTable) {
        console.log('[Migration] Altering table reclassification_nosca_items RENAME TO reclass_new_item_no...');
        await client.query(`ALTER TABLE reclassification_nosca_items RENAME TO reclass_new_item_no;`);
      } else {
        console.log('[Migration] Both tables exist. Keeping reclass_new_item_no.');
      }
    } else if (newTable && newTable.table_type === 'BASE TABLE') {
      console.log('[Migration] Table reclass_new_item_no already exists.');
    } else {
      console.log('[Migration] Creating table reclass_new_item_no...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS reclass_new_item_no (
          id SERIAL PRIMARY KEY,
          serial_no VARCHAR(100),
          plantilla_item_number VARCHAR(150) NOT NULL UNIQUE,
          category VARCHAR(50) DEFAULT 'ELEMENTARY',
          position_title VARCHAR(255) DEFAULT 'School Counselor Associate I',
          division VARCHAR(255),
          school_id VARCHAR(50),
          school_name VARCHAR(255),
          source_type VARCHAR(50) DEFAULT 'pdf_scan',
          file_name VARCHAR(255),
          assignment_status VARCHAR(50) DEFAULT 'AVAILABLE',
          assigned_to_incumbent_id INTEGER REFERENCES reclass_gc(id) ON DELETE SET NULL,
          assigned_to_employee_id TEXT,
          assigned_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    }

    // Ensure indexes on reclass_new_item_no
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_new_item_no_item ON reclass_new_item_no(plantilla_item_number);
      CREATE INDEX IF NOT EXISTS idx_reclass_new_item_no_serial ON reclass_new_item_no(serial_no);
      CREATE INDEX IF NOT EXISTS idx_reclass_new_item_no_status ON reclass_new_item_no(assignment_status);
      CREATE INDEX IF NOT EXISTS idx_reclass_new_item_no_assigned ON reclass_new_item_no(assigned_to_incumbent_id);
    `);

    // Ensure backward compatibility: create view reclassification_nosca_items if not already a base table
    const recheckOld = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'reclassification_nosca_items';
    `);

    if (recheckOld.rows.length === 0) {
      console.log('[Migration] Creating compatibility view reclassification_nosca_items...');
      await client.query(`
        CREATE OR REPLACE VIEW reclassification_nosca_items AS 
        SELECT * FROM reclass_new_item_no;
      `);
    }

    await client.query('COMMIT');
    console.log('[Migration] Successfully renamed/configured reclass_new_item_no.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - reclass_new_item_no]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('migration_rename_nosca_items_to_reclass_new_item_no')) {
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

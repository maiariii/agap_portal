import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Renaming table to reclass_item_no...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Determine existing base table name
    const findBaseTableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('reclass_item_no', 'reeclass_item_no', 'reclass_new_item_no', 'reclassification_nosca_items');
    `);

    const existingBaseTables = findBaseTableRes.rows.map(r => r.table_name);
    console.log('[Migration] Found base tables:', existingBaseTables);

    if (existingBaseTables.includes('reclass_item_no')) {
      console.log('[Migration] reclass_item_no already exists as a base table.');
    } else if (existingBaseTables.includes('reclass_new_item_no')) {
      console.log('[Migration] Renaming reclass_new_item_no TO reclass_item_no...');
      await client.query(`ALTER TABLE reclass_new_item_no RENAME TO reclass_item_no;`);
    } else if (existingBaseTables.includes('reclassification_nosca_items')) {
      console.log('[Migration] Renaming reclassification_nosca_items TO reclass_item_no...');
      await client.query(`ALTER TABLE reclassification_nosca_items RENAME TO reclass_item_no;`);
    } else if (existingBaseTables.includes('reeclass_item_no')) {
      console.log('[Migration] Renaming reeclass_item_no TO reclass_item_no...');
      await client.query(`ALTER TABLE reeclass_item_no RENAME TO reclass_item_no;`);
    } else {
      console.log('[Migration] Creating reclass_item_no base table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS reclass_item_no (
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

    // Ensure indexes on reclass_item_no
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_item_no_item ON reclass_item_no(plantilla_item_number);
      CREATE INDEX IF NOT EXISTS idx_reclass_item_no_serial ON reclass_item_no(serial_no);
      CREATE INDEX IF NOT EXISTS idx_reclass_item_no_status ON reclass_item_no(assignment_status);
      CREATE INDEX IF NOT EXISTS idx_reclass_item_no_assigned ON reclass_item_no(assigned_to_incumbent_id);
    `);

    // Create compatibility views so reeclass_item_no, reclass_new_item_no, and reclassification_nosca_items all work!
    const compatibilityAliases = ['reeclass_item_no', 'reclass_new_item_no', 'reclassification_nosca_items'];
    for (const alias of compatibilityAliases) {
      const checkAlias = await client.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [alias]);

      if (checkAlias.rows.length === 0) {
        console.log(`[Migration] Creating compatibility view ${alias} -> reclass_item_no...`);
        await client.query(`CREATE OR REPLACE VIEW ${alias} AS SELECT * FROM reclass_item_no;`);
      } else if (checkAlias.rows[0].table_type === 'VIEW') {
        await client.query(`CREATE OR REPLACE VIEW ${alias} AS SELECT * FROM reclass_item_no;`);
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] Successfully configured reclass_item_no (and aliases).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - reclass_item_no]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('migration_rename_to_reclass_item_no')) {
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

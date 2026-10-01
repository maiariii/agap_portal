import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring reclass_gc has school_id and school_name physically beside division...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check current column order
    const colOrderRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reclass_gc' 
      ORDER BY ordinal_position
    `);
    const cols = colOrderRes.rows.map(r => r.column_name);

    const divIdx = cols.indexOf('division');
    const schIdIdx = cols.indexOf('school_id');
    const schNameIdx = cols.indexOf('school_name');

    // If school_id and school_name are already directly after division, no reorder needed
    if (divIdx !== -1 && schIdIdx === divIdx + 1 && schNameIdx === divIdx + 2) {
      console.log('[Migration] reclass_gc columns are already in correct order.');
      await client.query('COMMIT');
      return;
    }

    console.log('[Migration] Reordering reclass_gc columns so school_id and school_name sit beside division...');

    // 2. Create replacement table with exact column order
    await client.query(`
      CREATE TABLE reclass_gc_new (
        id SERIAL PRIMARY KEY,
        item_no VARCHAR(150),
        current_position VARCHAR(255),
        first_name VARCHAR(150),
        last_name VARCHAR(150),
        email VARCHAR(255),
        region VARCHAR(255),
        division VARCHAR(255),
        school_id VARCHAR(50),
        school_name VARCHAR(255),
        qs_status VARCHAR(100),
        stage_of_reclassification VARCHAR(100) DEFAULT 'For Review',
        reclass_position VARCHAR(255),
        new_item_no VARCHAR(150),
        is_test BOOLEAN DEFAULT false,
        reupload BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Migrate existing rows if any
    await client.query(`
      INSERT INTO reclass_gc_new (
        id, item_no, current_position, first_name, last_name, email,
        region, division, school_id, school_name, qs_status,
        stage_of_reclassification, reclass_position, new_item_no,
        is_test, reupload, created_at, updated_at
      )
      SELECT 
        id, item_no, current_position, first_name, last_name, email,
        region, division, school_id, school_name, qs_status,
        stage_of_reclassification, reclass_position, new_item_no,
        is_test, reupload, created_at, updated_at
      FROM reclass_gc;
    `);

    // 4. Synchronize serial sequence
    await client.query(`
      SELECT setval(pg_get_serial_sequence('reclass_gc_new', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) 
      FROM reclass_gc_new;
    `);

    // 5. Drop old table and foreign keys
    await client.query(`DROP TABLE reclass_gc CASCADE;`);

    // 6. Rename new table to reclass_gc
    await client.query(`ALTER TABLE reclass_gc_new RENAME TO reclass_gc;`);

    // 7. Recreate indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_item_no ON reclass_gc(item_no);
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_region ON reclass_gc(region);
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_division ON reclass_gc(division);
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_school_id ON reclass_gc(school_id);
    `);

    // 8. Re-add foreign key constraints
    await client.query(`
      ALTER TABLE reclassification_nosca_items
      DROP CONSTRAINT IF EXISTS reclassification_nosca_items_assigned_to_incumbent_id_fkey;
      ALTER TABLE reclassification_nosca_items
      ADD CONSTRAINT reclassification_nosca_items_assigned_to_incumbent_id_fkey
      FOREIGN KEY (assigned_to_incumbent_id) REFERENCES reclass_gc(id) ON DELETE SET NULL;

      ALTER TABLE reclass_applications
      DROP CONSTRAINT IF EXISTS reclassification_application_incumbent_id_fkey;
      ALTER TABLE reclass_applications
      ADD CONSTRAINT reclassification_application_incumbent_id_fkey
      FOREIGN KEY (incumbent_id) REFERENCES reclass_gc(id) ON DELETE SET NULL;
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully reordered reclass_gc columns beside division.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - reclass_gc school columns]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('migration_reclass_gc_school')) {
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

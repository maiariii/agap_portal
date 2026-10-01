import { pool } from '../config/db.js';

export async function runDropColumns() {
  console.log('[Migration] Dropping added columns from reclass_item_no...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop indexes on added columns if they exist
    await client.query(`
      DROP INDEX IF EXISTS idx_reclass_item_no_item CASCADE;
      DROP INDEX IF EXISTS idx_reclass_item_no_serial CASCADE;
      DROP INDEX IF EXISTS idx_reclass_item_no_assigned CASCADE;
    `);

    // Drop views if they depend on those columns, so we can recreate them clean
    await client.query(`
      DROP VIEW IF EXISTS reclassification_nosca_items CASCADE;
      DROP VIEW IF EXISTS reclass_new_item_no CASCADE;
    `);

    // Drop the added columns
    await client.query(`
      ALTER TABLE reclass_item_no
      DROP COLUMN IF EXISTS serial_no CASCADE,
      DROP COLUMN IF EXISTS plantilla_item_number CASCADE,
      DROP COLUMN IF EXISTS position_title CASCADE,
      DROP COLUMN IF EXISTS source_type CASCADE,
      DROP COLUMN IF EXISTS file_name CASCADE,
      DROP COLUMN IF EXISTS assignment_status CASCADE,
      DROP COLUMN IF EXISTS assigned_to_incumbent_id CASCADE,
      DROP COLUMN IF EXISTS assigned_to_employee_id CASCADE,
      DROP COLUMN IF EXISTS assigned_at CASCADE;
    `);

    // Recreate views matching base table
    await client.query(`
      CREATE OR REPLACE VIEW reclassification_nosca_items AS 
      SELECT 
        id,
        new_item_no AS plantilla_item_number,
        new_item_no,
        category,
        position AS position_title,
        position,
        region,
        division,
        school_id,
        school_name,
        new_item_no_status AS assignment_status,
        new_item_no_status,
        reclass_gc_id AS assigned_to_incumbent_id,
        reclass_gc_id,
        reclass_at AS assigned_at,
        created_at,
        updated_at
      FROM reclass_item_no;
    `);

    await client.query(`
      CREATE OR REPLACE VIEW reclass_new_item_no AS 
      SELECT * FROM reclass_item_no;
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully dropped added columns from reclass_item_no.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('drop_added_reclass_item_no_cols.js')) {
  runDropColumns().then(() => process.exit(0)).catch(() => process.exit(1));
}

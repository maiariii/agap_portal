import { pool } from '../config/db.js';

export async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting Unique Constraint on reclass_gc.item_no...');
    await client.query('BEGIN');

    // 1. Clean up any existing duplicates in reclass_gc (keep row with highest id)
    await client.query(`
      DELETE FROM reclass_gc a
      USING reclass_gc b
      WHERE a.id < b.id
        AND a.item_no IS NOT NULL
        AND a.item_no != ''
        AND a.item_no = b.item_no;
    `);

    // 2. Update trigger trg_uppercase_reclass_gc to ensure empty strings are converted to NULL
    await client.query(`
      CREATE OR REPLACE FUNCTION public.trg_uppercase_reclass_gc()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.item_no IS NOT NULL THEN 
          NEW.item_no := NULLIF(UPPER(TRIM(NEW.item_no)), ''); 
        END IF;
        IF NEW.current_position IS NOT NULL THEN NEW.current_position := UPPER(TRIM(NEW.current_position)); END IF;
        IF NEW.first_name IS NOT NULL THEN NEW.first_name := UPPER(TRIM(NEW.first_name)); END IF;
        IF NEW.last_name IS NOT NULL THEN NEW.last_name := UPPER(TRIM(NEW.last_name)); END IF;
        IF NEW.email IS NOT NULL THEN NEW.email := UPPER(TRIM(NEW.email)); END IF;
        IF NEW.region IS NOT NULL THEN NEW.region := UPPER(TRIM(NEW.region)); END IF;
        IF NEW.division IS NOT NULL THEN NEW.division := UPPER(TRIM(NEW.division)); END IF;
        IF NEW.school_id IS NOT NULL THEN NEW.school_id := UPPER(TRIM(NEW.school_id)); END IF;
        IF NEW.school_name IS NOT NULL THEN NEW.school_name := UPPER(TRIM(NEW.school_name)); END IF;
        IF NEW.qs_status IS NOT NULL THEN NEW.qs_status := UPPER(TRIM(NEW.qs_status)); END IF;
        IF NEW.stage_of_reclassification IS NOT NULL THEN NEW.stage_of_reclassification := UPPER(TRIM(NEW.stage_of_reclassification)); END IF;
        IF NEW.reclass_position IS NOT NULL THEN NEW.reclass_position := UPPER(TRIM(NEW.reclass_position)); END IF;
        IF NEW.new_item_no IS NOT NULL THEN NEW.new_item_no := UPPER(TRIM(NEW.new_item_no)); END IF;
        RETURN NEW;
      END;
      $function$;
    `);

    // 3. Drop existing non-unique index if present
    await client.query(`DROP INDEX IF EXISTS idx_reclass_gc_item_no;`);

    // 4. Drop constraint if it already exists
    await client.query(`
      ALTER TABLE reclass_gc 
      DROP CONSTRAINT IF EXISTS uq_reclass_gc_item_no;
    `);

    // 5. Add unique constraint on item_no
    await client.query(`
      ALTER TABLE reclass_gc 
      ADD CONSTRAINT uq_reclass_gc_item_no UNIQUE (item_no);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully added UNIQUE constraint uq_reclass_gc_item_no on reclass_gc(item_no)!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed to add unique constraint:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('migration_unique_reclass_gc_item_no')) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

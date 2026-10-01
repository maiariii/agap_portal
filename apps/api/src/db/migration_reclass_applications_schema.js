import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring reclass_applications has exact requested schema...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check current columns
    const colOrderRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reclass_applications' 
      ORDER BY ordinal_position
    `);
    const existingCols = colOrderRes.rows.map(r => r.column_name);

    const targetCols = [
      'id',
      'reclass_gc_id',
      'item_no',
      'current_position',
      'region',
      'division',
      'school_id',
      'school_name',
      'reclass_position',
      'new_item_no',
      'created_at',
      'updated_at'
    ];

    const isMatch = existingCols.length === targetCols.length &&
      existingCols.every((c, i) => c === targetCols[i]);

    if (isMatch) {
      console.log('[Migration] reclass_applications columns already match desired schema.');
      await client.query('COMMIT');
      return;
    }

    console.log('[Migration] Recreating reclass_applications with new column structure...');

    // 2. Create new table
    await client.query(`
      CREATE TABLE reclass_applications_new (
        id SERIAL PRIMARY KEY,
        reclass_gc_id INTEGER REFERENCES reclass_gc(id) ON DELETE SET NULL,
        item_no VARCHAR(150),
        current_position VARCHAR(255),
        region VARCHAR(255),
        division VARCHAR(255),
        school_id VARCHAR(50),
        school_name VARCHAR(255),
        reclass_position VARCHAR(255),
        new_item_no VARCHAR(150),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Migrate existing rows if table exists and has rows
    if (existingCols.length > 0) {
      const hasIncumbentId = existingCols.includes('incumbent_id');
      const hasReclassGcId = existingCols.includes('reclass_gc_id');
      const gcIdCol = hasReclassGcId ? 'reclass_gc_id' : (hasIncumbentId ? 'incumbent_id' : 'NULL');

      const hasItemNo = existingCols.includes('item_no');
      const hasCurrentItemNumber = existingCols.includes('current_item_number');
      const itemNoCol = hasItemNo ? 'item_no' : (hasCurrentItemNumber ? 'current_item_number' : 'NULL');

      const hasCurrentPosition = existingCols.includes('current_position');
      const hasPositionTitle = existingCols.includes('position_title');
      const currentPosCol = hasCurrentPosition ? 'current_position' : (hasPositionTitle ? 'position_title' : 'NULL');

      const hasRegion = existingCols.includes('region') ? 'region' : 'NULL';
      const hasDivision = existingCols.includes('division') ? 'division' : 'NULL';
      const hasSchoolId = existingCols.includes('school_id') ? 'school_id' : 'NULL';
      const hasSchoolName = existingCols.includes('school_name') ? 'school_name' : 'NULL';

      const hasReclassPos = existingCols.includes('reclass_position');
      const hasActualPos = existingCols.includes('actual_position');
      const reclassPosCol = hasReclassPos ? 'reclass_position' : (hasActualPos ? 'actual_position' : 'NULL');

      const hasNewItemNo = existingCols.includes('new_item_no');
      const hasNewItemNumber = existingCols.includes('new_item_number');
      const newItemNoCol = hasNewItemNo ? 'new_item_no' : (hasNewItemNumber ? 'new_item_number' : 'NULL');

      const createdCol = existingCols.includes('created_at') ? 'created_at' : 'NOW()';
      const updatedCol = existingCols.includes('updated_at') ? 'updated_at' : 'NOW()';

      await client.query(`
        INSERT INTO reclass_applications_new (
          id, reclass_gc_id, item_no, current_position, region, division,
          school_id, school_name, reclass_position, new_item_no,
          created_at, updated_at
        )
        SELECT 
          id, ${gcIdCol}, ${itemNoCol}, ${currentPosCol}, ${hasRegion}, ${hasDivision},
          ${hasSchoolId}, ${hasSchoolName}, ${reclassPosCol}, ${newItemNoCol},
          ${createdCol}, ${updatedCol}
        FROM reclass_applications;
      `);

      await client.query(`
        SELECT setval(pg_get_serial_sequence('reclass_applications_new', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) 
        FROM reclass_applications_new;
      `);

      await client.query(`DROP TABLE reclass_applications CASCADE;`);
    }

    // 4. Rename to reclass_applications
    await client.query(`ALTER TABLE reclass_applications_new RENAME TO reclass_applications;`);

    // 5. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_applications_gc_id ON reclass_applications(reclass_gc_id);
      CREATE INDEX IF NOT EXISTS idx_reclass_applications_item_no ON reclass_applications(item_no);
      CREATE INDEX IF NOT EXISTS idx_reclass_applications_division ON reclass_applications(division);
      CREATE INDEX IF NOT EXISTS idx_reclass_applications_school_id ON reclass_applications(school_id);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully updated reclass_applications schema.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error - reclass_applications schema]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('migration_reclass_applications_schema')) {
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

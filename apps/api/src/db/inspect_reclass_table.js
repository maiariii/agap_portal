import { pool } from '../config/db.js';

async function run() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%reclass%';
    `);
    console.log('Reclass tables in DB:', res.rows.map(r => r.table_name));

    for (const t of res.rows) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [t.table_name]);
      console.log(`\n=== Columns of ${t.table_name} ===`);
      console.table(cols.rows);

      // Check row count
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${t.table_name}"`);
      console.log(`Row count in ${t.table_name}: ${countRes.rows[0].count}`);
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();

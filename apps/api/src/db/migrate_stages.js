import { pool } from '../config/db.js';

async function migrate() {
  try {
    const res = await pool.query(`
      UPDATE incumbent_guidance_counselors 
      SET stage_of_reclassification = 'Endorsed to RO' 
      WHERE stage_of_reclassification = 'Endorsed';
    `);
    console.log(`Successfully migrated ${res.rowCount} incumbent records from 'Endorsed' to 'Endorsed to RO'.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

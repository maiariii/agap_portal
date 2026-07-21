import { pool } from '../config/db.js';

async function run() {
  console.log("Running migration item_to_cluster...");
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Migrate any 'appointed' applications to 'FOR APPOINTMENT'
    console.log("Updating appointment_status in applications table...");
    const res = await client.query(`
      UPDATE applications 
      SET appointment_status = 'FOR APPOINTMENT' 
      WHERE appointment_status = 'appointed' 
      RETURNING id, appointment_item_no
    `);
    console.log(`Migrated ${res.rowCount} application(s) from 'appointed' to 'FOR APPOINTMENT'.`);

    // Ensure corresponding vacancies are closed and FILLED
    for (const row of res.rows) {
      if (row.appointment_item_no) {
        await client.query(`
          UPDATE vacancies 
          SET status = 'closed', filling_up_status = 'FILLED', updated_at = NOW() 
          WHERE item_no = $1
        `, [row.appointment_item_no]);
        console.log(`Ensured vacancy item ${row.appointment_item_no} is status='closed' and filling_up_status='FILLED'.`);
      }
    }

    await client.query('COMMIT');
    console.log("Migration completed successfully!");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);

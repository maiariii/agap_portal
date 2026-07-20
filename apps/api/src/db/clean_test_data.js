import { pool } from '../config/db.js';

async function clean() {
  console.log("Removing all test data from applicants, applications, vacancies, and positions...");
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM qual_evals');
    await client.query('DELETE FROM application_history');
    await client.query('DELETE FROM applications');
    await client.query('DELETE FROM applicants');
    await client.query('DELETE FROM vacancies');
    await client.query('DELETE FROM positions');
    await client.query('COMMIT');
    console.log("All test data removed successfully!");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Failed to remove test data:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

clean();

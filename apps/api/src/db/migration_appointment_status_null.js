import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  console.log("Connecting to PostgreSQL database...");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log("Altering appointment_status column constraints...");
    // Drop any default on appointment_status (ensure it defaults to NULL)
    await pool.query(`
      ALTER TABLE applications ALTER COLUMN appointment_status DROP DEFAULT;
    `);

    console.log("Backfilling: setting appointment_status = NULL for rows that are not explicitly 'FOR APPOINTMENT' or 'appointed'...");
    await pool.query(`
      UPDATE applications 
      SET appointment_status = NULL 
      WHERE appointment_status IS DISTINCT FROM 'FOR APPOINTMENT' 
        AND appointment_status IS DISTINCT FROM 'appointed';
    `);

    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

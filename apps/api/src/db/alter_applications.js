import { pool } from '../config/db.js';

async function main() {
  try {
    console.log("Checking and altering applications table...");
    // Add application_status column if it doesn't exist
    await pool.query(`
      ALTER TABLE applications 
      ADD COLUMN IF NOT EXISTS application_status TEXT NOT NULL DEFAULT 'Application Submitted';
    `);
    
    // Copy existing status values to application_status if they represent initial statuses,
    // or set to 'Qualified' if they have already progressed beyond initial status (e.g. for_comparative_assessment, appointed, etc.)
    await pool.query(`
      UPDATE applications 
      SET application_status = CASE 
        WHEN LOWER(status) IN ('application submitted', 'pending qs review', 'qualified', 'disqualified', 'excluded') THEN status
        WHEN LOWER(status) IN ('for_comparative_assessment', 'appointed', 'not_appointed', 'rejected') THEN 'Qualified'
        ELSE 'Application Submitted'
      END
      WHERE application_status = 'Application Submitted';
    `);
    
    console.log("Database altered successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to alter table:", error);
    process.exit(1);
  }
}

main();

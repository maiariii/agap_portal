import { pool } from '../config/db.js';

async function main() {
  try {
    console.log("Checking and altering users table...");
    
    // Add columns to users if they do not exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS first_name TEXT,
      ADD COLUMN IF NOT EXISTS last_name TEXT,
      ADD COLUMN IF NOT EXISTS region TEXT,
      ADD COLUMN IF NOT EXISTS division TEXT;
    `);

    // Populate the newly added columns for existing users
    // Split full_name at the first space to estimate first/last name
    // Parse Region / Division from office string if it looks like "Region: X, Division: Y"
    await pool.query(`
      UPDATE users 
      SET 
        first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
        last_name = COALESCE(last_name, substring(full_name from ' .*')),
        region = COALESCE(region, substring(office from 'Region: ([^,]+)')),
        division = COALESCE(division, substring(office from 'Division: (.+)'))
      WHERE first_name IS NULL OR last_name IS NULL;
    `);

    console.log("Users table altered successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to alter users table:", error);
    process.exit(1);
  }
}

main();

import { pool } from '../config/db.js';

async function run() {
  console.log("Running migration...");
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add job_cluster_id to vacancies
    console.log("Adding job_cluster_id to vacancies table...");
    await client.query(`
      ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS job_cluster_id TEXT;
    `);

    // 2. Populate job_cluster_id in vacancies
    console.log("Populating job_cluster_id in vacancies...");
    await client.query(`
      UPDATE vacancies 
      SET job_cluster_id = md5(position_id || '|' || COALESCE(division, '') || '|' || COALESCE(region, ''));
    `);

    // 3. Drop foreign key constraint from applications to vacancies if it exists
    console.log("Checking applications constraints...");
    const constraintsResult = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'applications' AND constraint_type = 'FOREIGN KEY';
    `);
    for (const row of constraintsResult.rows) {
      if (row.constraint_name.includes('vacancy_id')) {
        console.log(`Dropping constraint: ${row.constraint_name}`);
        await client.query(`ALTER TABLE applications DROP CONSTRAINT IF EXISTS ${row.constraint_name};`);
      }
    }

    // Drop the old unique constraint (applicant_id, vacancy_id) first to avoid violation during update
    console.log("Dropping old unique constraint on applications...");
    const uniqueConstraints = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'applications' AND constraint_type = 'UNIQUE';
    `);
    for (const row of uniqueConstraints.rows) {
      if (row.constraint_name.includes('applicant_id') || row.constraint_name.includes('vacancy_id')) {
        console.log(`Dropping unique constraint: ${row.constraint_name}`);
        await client.query(`ALTER TABLE applications DROP CONSTRAINT IF EXISTS ${row.constraint_name};`);
      }
    }

    // 4. Update applications.vacancy_id to point to the job_cluster_id of the vacancy it referred to
    console.log("Updating applications.vacancy_id to refer to job_cluster_id...");
    await client.query(`
      UPDATE applications a
      SET vacancy_id = v.job_cluster_id
      FROM vacancies v
      WHERE a.vacancy_id = v.id;
    `);

    // Deduplicate applications mapping to the same applicant_id and vacancy_id (job_cluster_id)
    console.log("Deduplicating applications...");
    await client.query(`
      DELETE FROM applications
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM applications
        GROUP BY applicant_id, vacancy_id
      );
    `);

    // 6. Add new unique constraint (applicant_id, vacancy_id) which is now (applicant_id, job_cluster_id)
    console.log("Adding unique constraint (applicant_id, vacancy_id) on applications table...");
    await client.query(`
      ALTER TABLE applications ADD CONSTRAINT applications_applicant_id_vacancy_id_unique UNIQUE(applicant_id, vacancy_id);
    `);

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

run();

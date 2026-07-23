import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const firstNames = [
  "Roronoa", "Zoro", "Luffy", "Nami", "Sanji", "Usopp", "Chopper", "Robin", "Franky", "Brook",
  "Jinbe", "Vivi", "Ace", "Sabo", "Law", "Kid", "Killer", "Hawkins", "Drake", "Apoo",
  "Bege", "Bonney", "Urouge", "Yamato", "Shanks"
];
const lastNames = [
  "Pirate", "Swordsman", "Captain", "Navigator", "Cook", "Sniper", "Doctor", "Archaeologist", "Shipwright", "Musician",
  "Knight", "Princess", "Firefist", "Revolutionary", "Surgeon", "Magnet", "Scythe", "Magician", "Dino", "Roar",
  "Castle", "Glutton", "Monk", "Ogre", "Redhair"
];

const degreePool = [
  { degree: "Bachelor of Science in Psychology", major: "Psychology", elig: "RA 1080 / Guidance Counselor License" },
  { degree: "Bachelor in Guidance and Counseling", major: "Guidance and Counseling", elig: "RA 1080 / Guidance Counselor License" }
];

async function main() {
  console.log("Connecting to PostgreSQL database...");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    // 1. Create Zoro User
    const passwordHash = await bcrypt.hash("password", 10);
    const passcodeHash = await bcrypt.hash("123456", 10);
    const zoroId = crypto.randomUUID();

    console.log("Inserting user zoro@deped.gov.ph...");
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, region, division, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (username) DO UPDATE 
       SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, passcode_hash = EXCLUDED.passcode_hash, division = EXCLUDED.division, region = EXCLUDED.region`,
      [zoroId, "zoro@deped.gov.ph", "zoro@deped.gov.ph", "Roronoa Zoro", "NCR", "SDO Manila", passwordHash, passcodeHash, "hr_officer", "active"]
    );

    // WIPE all other data cascade-style (except users)
    console.log("Truncating existing positions, vacancies, and applications data...");
    await pool.query('TRUNCATE public.qual_evals, public.application_history, public.applications, public.vacancies, public.job_clusters, public.positions, public.applicants CASCADE;');

    // 2. Ensure "School Counselor Associate I" position exists
    const positionId = "school-counselor-associate-i-pos-id";
    console.log("Ensuring position 'School Counselor Associate I' exists...");
    await pool.query(
      `INSERT INTO positions (id, title, track, required_bachelor_degree, required_degree_keywords, min_years_experience, min_training_hours, eligibility_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [positionId, "School Counselor Associate I", "learner_support", "Bachelor in Guidance and Counseling or Psychology", "guidance,counseling,psychology", 0, 0, "RA 1080 / Guidance Counselor License"]
    );

    // 3. Create exactly one job cluster for it
    const clusterId = crypto.createHash('md5').update(`${positionId}|SDO Manila|NCR`).digest('hex');
    console.log("Creating job cluster for School Counselor Associate I in SDO Manila...");
    await pool.query(
      `INSERT INTO job_clusters (id, position_id, division, region)
       VALUES ($1, $2, $3, $4)`,
      [clusterId, positionId, "SDO Manila", "NCR"]
    );

    // 4. Create 10 open vacancies (items) under this cluster
    console.log("Creating 10 open vacancies (SCA-001 to SCA-010) under the cluster...");
    for (let j = 1; j <= 10; j++) {
      const itemNo = `SCA-${String(j).padStart(3, "0")}`;
      await pool.query(
        `INSERT INTO vacancies (id, position_id, item_no, title, school, division, region, status, filling_up_status, job_cluster_id, salary_grade)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [crypto.randomUUID(), positionId, itemNo, "School Counselor Associate I", "SDO Manila", "SDO Manila", "NCR", "open", "UNFILLED", clusterId, 11]
      );
    }

    // 5. Seed 25 applicants and applications for this single job cluster
    console.log("Seeding 25 mock applications for School Counselor Associate I...");
    for (let i = 0; i < 25; i++) {
      const degree = degreePool[i % degreePool.length];
      const email = `zoro_applicant_${i + 1}@deped.gov.ph`;
      const codeVal = `ZORO-2026-${String(100000 + i + 1).padStart(6, "0")}`;

      const { rows: applicantRows } = await pool.query(
        `INSERT INTO applicants (surname, first_name, email_address, code, local_resident, bachelor_degree, major, years_experience, training_hours, eligibility, applicant_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [lastNames[i % lastNames.length], firstNames[i % firstNames.length], email, codeVal, true, degree.degree, degree.major, (i * 2) % 6, (i * 8) % 40, degree.elig, codeVal]
      );
      const applicantId = applicantRows[0].id;

      const appId = crypto.randomUUID();
      const appNum = `APP-ZORO-${String(i + 1).padStart(3, "0")}`;

      // Distribute statuses:
      // i = 0..4 (5 apps) -> Application Submitted
      // i = 5..9 (5 apps) -> qualified (Assessment Not Started)
      // i = 10..14 (5 apps) -> for_comparative_assessment (Assessment Started)
      // i = 15..19 (5 apps) -> for_comparative_assessment (ASSESSMENT COMPLETE)
      // i = 20..22 (3 apps) -> FOR APPOINTMENT (appointed status)
      // i = 23..24 (2 apps) -> disqualified
      let status = "Application Submitted";
      let appStatus = "Application Submitted";
      let assessmentStatus = null;
      let compScores = null;
      let apptStatus = null;
      let apptItemNo = null;

      if (i >= 5 && i <= 9) {
        status = "qualified";
        appStatus = "Qualified";
        assessmentStatus = "Assessment Not Started";
      } else if (i >= 10 && i <= 14) {
        status = "for_comparative_assessment";
        appStatus = "Qualified";
        assessmentStatus = "Assessment Started";
        compScores = { bei: 80 + (i % 5), wst: 75 + (i % 5), we: 85 };
      } else if (i >= 15 && i <= 19) {
        status = "for_comparative_assessment";
        appStatus = "Qualified";
        assessmentStatus = "ASSESSMENT COMPLETE";
        compScores = { bei: 85 + (i % 5), wst: 88 + (i % 5), we: 90 };
      } else if (i >= 20 && i <= 22) {
        status = "for_comparative_assessment";
        appStatus = "Qualified";
        assessmentStatus = "ASSESSMENT COMPLETE";
        compScores = { bei: 90, wst: 92, we: 94 };
        apptStatus = "FOR APPOINTMENT";
        
        // Fill SCA-001, SCA-002, SCA-003 initially
        const filledItem = `SCA-00${i - 19}`;
        apptItemNo = filledItem;
        await pool.query(
          `UPDATE vacancies SET status = 'closed', filling_up_status = 'FILLED' WHERE item_no = $1`,
          [filledItem]
        );
      } else if (i >= 23) {
        status = "disqualified";
        appStatus = "Disqualified";
      }

      await pool.query(
        `INSERT INTO applications (id, application_number, job_cluster_id, applicant_id, status, application_status, date_applied, assessment_status, comparative_assessment_scores, appointment_status, appointment_item_no, documents)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11)`,
        [appId, appNum, clusterId, applicantId, status, appStatus, assessmentStatus, compScores ? JSON.stringify(compScores) : null, apptStatus, apptItemNo, '{}']
      );

      // Seed qual_evals matching the overall score if assessment scores are present
      if (compScores) {
        const evalId = crypto.randomUUID();
        const areaScores = {
          education: 85,
          experience: 80,
          training: 75,
          eligibility: 85,
          outstandingAccomplishment: 80,
          documentCompleteness: 100,
          applicationEducation: 80,
          applicationLearning: 85,
          performanceRating: 90,
          potential: 85
        };
        await pool.query(
          `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, area_scores, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [evalId, appId, status, 83.5, 85, 80, 75, 85, JSON.stringify(areaScores), "Seeded test scores"]
        );
      }
    }

    console.log("Successfully seeded 25 applications under single SDO Manila School Counselor Associate I job cluster!");
  } catch (err) {
    console.error("Database seed failed:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

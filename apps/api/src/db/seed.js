import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeFit } from '@agap/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const firstNames = ["Maria", "Juan", "Ana", "Jose", "Liza", "Paolo", "Mika", "Carlo", "Rhea", "Nico", "Grace", "Erwin", "Lea", "Marco", "Iris", "Dante", "Jessa", "Ramon", "Celine", "Arman"];
const lastNames = ["Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Dela Cruz", "Torres", "Villanueva", "Ramos", "Aquino", "Flores", "Castillo", "Bautista", "Navarro", "Domingo", "Mercado", "Santiago", "Rivera", "Lim", "Chua"];

const degreePool = [
  { degree: "Bachelor of Elementary Education", major: "Elementary Education", elig: "LET / PRC License" },
  { degree: "Bachelor of Secondary Education", major: "English", elig: "LET / PRC License" },
  { degree: "Bachelor of Secondary Education", major: "Science", elig: "LET / PRC License" },
  { degree: "Bachelor of Secondary Education", major: "Mathematics", elig: "LET / PRC License" },
  { degree: "Bachelor of Arts in English", major: "English", elig: "LET / PRC License" },
  { degree: "Bachelor of Science in Psychology", major: "Psychology", elig: "RA 1080 / Guidance Counselor License" },
  { degree: "Bachelor in Guidance and Counseling", major: "Guidance and Counseling", elig: "RA 1080 / Guidance Counselor License" },
  { degree: "Bachelor of Science in Nursing", major: "Nursing", elig: "RA 1080 / Nursing License" },
  { degree: "Bachelor of Science in Business Administration", major: "Business Administration", elig: "Career Service Professional" },
  { degree: "Bachelor of Science in Accountancy", major: "Accounting", elig: "Career Service Professional" },
  { degree: "Bachelor in Public Administration", major: "Public Administration", elig: "Career Service Professional" },
  { degree: "Bachelor of Information Technology", major: "Information Technology", elig: "Career Service Subprofessional" }
];

async function main() {
  if (!process.argv.includes('--force-destructive-reset')) {
    console.error("=========================================================================");
    console.error("ERROR: SEED SCRIPT IS RUNNING IN DESTRUCTIVE MODE!");
    console.error("This script drops and truncates all database tables, deleting active data.");
    console.error("To proceed, you must execute the script with the explicit safety flag:");
    console.error("  node src/db/seed.js --force-destructive-reset");
    console.error("  or: npm run db:seed -- --force-destructive-reset");
    console.error("=========================================================================");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL database...");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log("Setting search path to public...");
    await pool.query('SET search_path TO public;');
    
    console.log("Dropping existing tables to clean up schema...");
    await pool.query('DROP TABLE IF EXISTS public.notifications, public.qual_evals, public.application_history, public.stored_files, public.sessions, public.applications, public.vacancies, public.positions, public.applicants, public.users, public.job_clusters CASCADE;');
    console.log("Creating tables...");
    
    // Create tables in order of dependencies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        region TEXT,
        division TEXT,
        contact_number TEXT,
        office TEXT,
        password_hash TEXT NOT NULL,
        passcode_hash TEXT,
        role TEXT NOT NULL DEFAULT 'hr_officer',
        status TEXT NOT NULL DEFAULT 'active',
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP,
        last_login_at TIMESTAMP,
        password_changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        must_change_password BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        track TEXT,
        required_bachelor_degree TEXT,
        required_degree_keywords TEXT NOT NULL,
        min_years_experience INTEGER NOT NULL DEFAULT 0,
        min_training_hours INTEGER NOT NULL DEFAULT 0,
        eligibility_required TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_clusters (
        id TEXT PRIMARY KEY,
        position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        division TEXT,
        region TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vacancies (
        id TEXT PRIMARY KEY,
        position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        item_no TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        school TEXT,
        division TEXT,
        region TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        filling_up_status VARCHAR(50) NOT NULL DEFAULT 'UNFILLED',
        job_cluster_id TEXT REFERENCES job_clusters(id) ON DELETE SET NULL,
        school_level TEXT,
        school_id INTEGER,
        posting_start TIMESTAMP,
        posting_end TIMESTAMP,
        salary_grade INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applicants (
        id SERIAL PRIMARY KEY,
        password_hash VARCHAR(255), 
        surname VARCHAR(100) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        date_of_birth DATE,
        place_of_birth VARCHAR(255),
        sex VARCHAR(20), 
        civil_status VARCHAR(50), 
        citizenship VARCHAR(100) DEFAULT 'Filipino',
        blood_type VARCHAR(10),
        gsis_id_no VARCHAR(50),
        pag_ibig_id_no VARCHAR(50),
        philhealth_no VARCHAR(50),
        sss_no VARCHAR(50),
        residential_address TEXT,
        permanent_address TEXT,
        telephone_no VARCHAR(50),
        mobile_no VARCHAR(50),
        email_address VARCHAR(150) UNIQUE NOT NULL,
        spouse_surname VARCHAR(100),
        spouse_first_name VARCHAR(100),
        spouse_occupation VARCHAR(150),
        father_surname VARCHAR(100),
        father_first_name VARCHAR(100),
        mother_maiden_surname VARCHAR(100),
        name_extension VARCHAR(50),
        height VARCHAR(20),
        weight VARCHAR(20),
        agency_employee_no VARCHAR(50),
        citizenship_type VARCHAR(50),
        spouse_middle_name VARCHAR(100),
        spouse_name_extension VARCHAR(50),
        spouse_employer_business VARCHAR(150),
        spouse_business_address VARCHAR(255),
        spouse_telephone VARCHAR(50),
        father_middle_name VARCHAR(100),
        father_name_extension VARCHAR(50),
        mother_first_name VARCHAR(100),
        mother_middle_name VARCHAR(100),
        children_details JSONB DEFAULT '[]'::jsonb,
        family_background JSONB,
        educational_background JSONB DEFAULT '[]'::jsonb, 
        civil_service_eligibility JSONB DEFAULT '[]'::jsonb,
        work_experience JSONB DEFAULT '[]'::jsonb,
        voluntary_work JSONB DEFAULT '[]'::jsonb,
        learning_and_development JSONB DEFAULT '[]'::jsonb,
        other_information JSONB DEFAULT '{}'::jsonb,
        questionnaire_responses JSONB DEFAULT '{}'::jsonb,
        name VARCHAR(255),
        code VARCHAR(255),
        local_resident BOOLEAN DEFAULT false,
        bachelor_degree VARCHAR(255),
        major VARCHAR(255),
        years_experience DOUBLE PRECISION DEFAULT 0,
        training_hours DOUBLE PRECISION DEFAULT 0,
        eligibility VARCHAR(255),
        applicant_number VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        application_number TEXT UNIQUE NOT NULL,
        job_cluster_id TEXT NOT NULL REFERENCES job_clusters(id) ON DELETE CASCADE,
        applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'Application Submitted',
        application_status TEXT NOT NULL DEFAULT 'Application Submitted',
        date_applied TIMESTAMP NOT NULL,
        documents TEXT NOT NULL DEFAULT '{}',
        documentary_complete BOOLEAN,
        doc_checklist TEXT,
        reason TEXT,
        assessment_status TEXT,
        comparative_assessment_scores TEXT,
        appointment_status TEXT,
        appointment_date TIMESTAMP,
        appointment_item_no TEXT,
        appointment_reference_code TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(applicant_id, job_cluster_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS application_history (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        text TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS qual_evals (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        result TEXT NOT NULL,
        overall_fit DOUBLE PRECISION,
        degree_score DOUBLE PRECISION,
        experience_score DOUBLE PRECISION,
        training_score DOUBLE PRECISION,
        eligibility_score DOUBLE PRECISION,
        degree_decision TEXT,
        experience_decision TEXT,
        training_decision TEXT,
        eligibility_decision TEXT,
        documentary_complete BOOLEAN,
        remarks TEXT,
        area_scores TEXT,
        at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Cleaning existing tables...");
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM qual_evals');
    await pool.query('DELETE FROM application_history');
    await pool.query('DELETE FROM applications');
    await pool.query('DELETE FROM applicants');
    await pool.query('DELETE FROM vacancies');
    await pool.query('DELETE FROM job_clusters');
    await pool.query('DELETE FROM positions');
    await pool.query('DELETE FROM users');

    console.log("Creating default users...");
    const passwordHash = await bcrypt.hash("password", 10);
    const passcodeHash = await bcrypt.hash("123456", 10);

    const adminId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, region, division, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [adminId, "admin", "admin@deped.gov.ph", "System Administrator", "NCR", "SDO Manila", passwordHash, passcodeHash, "admin", "active"]
    );

    const hrOfficerId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, region, division, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [hrOfficerId, "hr_officer", "hr@deped.gov.ph", "HR Officer", "NCR", "SDO Manila", passwordHash, passcodeHash, "hr_officer", "active"]
    );

    const zoroId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, region, division, office, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [zoroId, "zoro@deped.gov.ph", "zoro@deped.gov.ph", "Zoro Roronoa", "NCR", "QUEZON CITY", "Region: NCR, Division: QUEZON CITY", passcodeHash, passcodeHash, "hr_officer", "active"]
    );

    console.log("Seeding positions...");
    const positionsData = [
      { id: crypto.randomUUID(), title: "School Counselor Associate I", track: "learner_support", requiredBachelorDegree: "Bachelor in Guidance and Counseling or Psychology", requiredDegreeKeywords: ["guidance", "counseling", "psychology"], minYearsExperience: 0, minTrainingHours: 0, eligibilityRequired: "RA 1080 / Guidance Counselor License" }
    ];

    for (const pos of positionsData) {
      await pool.query(
        `INSERT INTO positions (id, title, track, required_bachelor_degree, required_degree_keywords, min_years_experience, min_training_hours, eligibility_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [pos.id, pos.title, pos.track, pos.requiredBachelorDegree, pos.requiredDegreeKeywords, pos.minYearsExperience, pos.minTrainingHours, pos.eligibilityRequired]
      );
    }

    console.log("Seeding vacancies...");
    const vacanciesData = [
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA-001", title: "School Counselor Associate I", school: "Rizal ES", division: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-07-28"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA-002", title: "School Counselor Associate I", school: "Manila Science HS", division: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-07-29"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA-003", title: "School Counselor Associate I", school: "Bonifacio ES", division: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-03"), postingEnd: new Date("2026-07-30"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA-004", title: "School Counselor Associate I", school: "SDO Manila", division: "Division Office", region: "NCR", status: "open", postingStart: new Date("2026-07-05"), postingEnd: new Date("2026-07-31"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA-005", title: "School Counselor Associate I", school: "Manila Integrated School", division: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-06"), postingEnd: new Date("2026-07-27"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA-006", title: "School Counselor Associate I", school: "Tondo HS", division: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-07"), postingEnd: new Date("2026-07-26"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA1-20001-2026", title: "School Counselor Associate I", school: "Rosa L. Susano - Novaliches Elementary School", division: "QUEZON CITY", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-07-31"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA1-20002-2026", title: "School Counselor Associate I", school: "", division: "QUEZON CITY", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-07-30"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA1-20003-2026", title: "School Counselor Associate I", school: "", division: "QUEZON CITY", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-07-29"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Counselor Associate I", itemNo: "SCA1-20004-2026", title: "School Counselor Associate I", school: "San Bartolome Elementary School", division: "QUEZON CITY", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-07-28"), salaryGrade: 11 }
    ];

    for (const vac of vacanciesData) {
      const pos = positionsData.find(p => p.title === vac.positionKey);
      const jobClusterId = crypto.createHash('md5').update(`${pos.id}|${vac.division || ''}|${vac.region || ''}`).digest('hex');
      await pool.query(
        `INSERT INTO job_clusters (id, position_id, division, region)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [jobClusterId, pos.id, vac.division, vac.region]
      );
      await pool.query(
        `INSERT INTO vacancies (id, position_id, item_no, title, school, division, region, status, posting_start, posting_end, salary_grade, job_cluster_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [vac.id, pos.id, vac.itemNo, vac.title, vac.school, vac.division, vac.region, vac.status, vac.postingStart, vac.postingEnd, vac.salaryGrade, jobClusterId]
      );
      vac.positionId = pos.id; // Map positionId for applicant generation
      vac.jobClusterId = jobClusterId;
    }

    console.log("Seeding 5 One Piece character applicants...");
    const onePieceApplicants = [
      { firstName: "Monkey D.", lastName: "Luffy", degree: { degree: "Bachelor of Arts in English", major: "English", elig: "LET / PRC License" }, yearsExperience: 2, trainingHours: 16 },
      { firstName: "Nico", lastName: "Robin", degree: { degree: "Bachelor of Science in Psychology", major: "Psychology", elig: "RA 1080 / Guidance Counselor License" }, yearsExperience: 8, trainingHours: 40 },
      { firstName: "Tony Tony", lastName: "Chopper", degree: { degree: "Bachelor of Science in Nursing", major: "Nursing", elig: "RA 1080 / Nursing License" }, yearsExperience: 5, trainingHours: 24 },
      { firstName: "Vinsmoke", lastName: "Sanji", degree: { degree: "Bachelor of Science in Business Administration", major: "Business Administration", elig: "Career Service Professional" }, yearsExperience: 4, trainingHours: 12 },
      { firstName: "Nami", lastName: "Navigator", degree: { degree: "Bachelor in Guidance and Counseling", major: "Guidance and Counseling", elig: "RA 1080 / Guidance Counselor License" }, yearsExperience: 6, trainingHours: 32 }
    ];

    const qcVacancies = vacanciesData.filter(v => v.division === 'QUEZON CITY');
    for (let k = 0; k < onePieceApplicants.length; k++) {
      const char = onePieceApplicants[k];
      const index = k + 1;
      const vacancy = qcVacancies[k % qcVacancies.length] || vacanciesData[0];
      const position = positionsData[0];
      const codeVal = `ONEPIECE-2026-${String(100000 + index).padStart(6, "0")}`;

      const { rows: applicantRows } = await pool.query(
        `INSERT INTO applicants (surname, first_name, email_address, code, local_resident, bachelor_degree, major, years_experience, training_hours, eligibility, applicant_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [char.lastName, char.firstName, `${char.firstName.toLowerCase().replace(/\s+/g, '')}_${char.lastName.toLowerCase()}@deped.gov.ph`, codeVal, true, char.degree.degree, char.degree.major, char.yearsExperience, char.trainingHours, char.degree.elig, codeVal]
      );
      const applicantId = applicantRows[0].id;

      const applicationId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO applications (id, application_number, job_cluster_id, applicant_id, status, date_applied, documents)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          applicationId,
          `APP-${String(index).padStart(3, "0")}`,
          vacancy.jobClusterId,
          applicantId,
          "Application Submitted",
          JSON.stringify({})
        ]
      );

      // Add to application history
      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, applicationId, "Mock One Piece character application submitted"]
      );

    }

    console.log("Database schema created and successfully seeded!");
  } catch (err) {
    console.error("Database initialization failed:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

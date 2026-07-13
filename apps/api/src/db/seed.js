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
    await pool.query('DROP TABLE IF EXISTS public.notifications, public.qual_evals, public.application_history, public.stored_files, public.sessions, public.applications, public.vacancies, public.positions, public.applicants, public.users CASCADE;');
    console.log("Creating tables...");
    
    // Create tables in order of dependencies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
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
      CREATE TABLE IF NOT EXISTS vacancies (
        id TEXT PRIMARY KEY,
        position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        item_no TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        school TEXT,
        location TEXT,
        region TEXT,
        status TEXT NOT NULL DEFAULT 'open',
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
        vacancy_id TEXT NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
        applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'Application Submitted',
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
        UNIQUE(applicant_id, vacancy_id)
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
    await pool.query('DELETE FROM positions');
    await pool.query('DELETE FROM users');

    console.log("Creating default users...");
    const passwordHash = await bcrypt.hash("password", 10);
    const passcodeHash = await bcrypt.hash("123456", 10);

    const adminId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [adminId, "admin", "admin@deped.gov.ph", "System Administrator", passwordHash, passcodeHash, "admin", "active"]
    );

    const hrOfficerId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [hrOfficerId, "hr_officer", "hr@deped.gov.ph", "HR Officer", passwordHash, passcodeHash, "hr_officer", "active"]
    );

    console.log("Seeding positions...");
    const positionsData = [
      { id: crypto.randomUUID(), title: "Teacher I", track: "teacher_i", requiredBachelorDegree: "Bachelor of Elementary Education or Bachelor of Secondary Education", requiredDegreeKeywords: ["education", "elementary", "secondary", "teaching"], minYearsExperience: 0, minTrainingHours: 0, eligibilityRequired: "LET / PRC License" },
      { id: crypto.randomUUID(), title: "Master Teacher I", track: "higher_teaching", requiredBachelorDegree: "Bachelor in Education or relevant bachelor's degree", requiredDegreeKeywords: ["education", "teaching"], minYearsExperience: 3, minTrainingHours: 24, eligibilityRequired: "LET / PRC License" },
      { id: crypto.randomUUID(), title: "Head Teacher I", track: "school_leadership", requiredBachelorDegree: "Bachelor in Education with school leadership preparation", requiredDegreeKeywords: ["education", "teaching", "leadership"], minYearsExperience: 5, minTrainingHours: 40, eligibilityRequired: "LET / PRC License" },
      { id: crypto.randomUUID(), title: "Administrative Officer II", track: "administrative", requiredBachelorDegree: "Bachelor in Business Administration, Public Administration, Accounting, or Management", requiredDegreeKeywords: ["business", "public administration", "accounting", "management"], minYearsExperience: 1, minTrainingHours: 8, eligibilityRequired: "Career Service Professional" },
      { id: crypto.randomUUID(), title: "Guidance Counselor I", track: "learner_support", requiredBachelorDegree: "Bachelor in Guidance and Counseling, Psychology, or Education", requiredDegreeKeywords: ["guidance", "counseling", "psychology", "education"], minYearsExperience: 1, minTrainingHours: 16, eligibilityRequired: "RA 1080 / Guidance Counselor License" },
      { id: crypto.randomUUID(), title: "School Nurse II", track: "health", requiredBachelorDegree: "Bachelor of Science in Nursing", requiredDegreeKeywords: ["nursing"], minYearsExperience: 1, minTrainingHours: 8, eligibilityRequired: "RA 1080 / Nursing License" }
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
      { id: crypto.randomUUID(), positionKey: "Teacher I", itemNo: "TCH1-001", title: "Teacher I - Elementary", school: "Rizal ES", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-08-15"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "Master Teacher I", itemNo: "MT1-002", title: "Master Teacher I", school: "Manila Science HS", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-08-20"), salaryGrade: 18 },
      { id: crypto.randomUUID(), positionKey: "Head Teacher I", itemNo: "HT1-003", title: "Head Teacher I", school: "Bonifacio ES", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-03"), postingEnd: new Date("2026-08-25"), salaryGrade: 14 },
      { id: crypto.randomUUID(), positionKey: "Administrative Officer II", itemNo: "AO2-004", title: "Administrative Officer II", school: "SDO Manila", location: "Division Office", region: "NCR", status: "open", postingStart: new Date("2026-07-05"), postingEnd: new Date("2026-08-18"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "Guidance Counselor I", itemNo: "GC1-005", title: "Guidance Counselor I", school: "Manila Integrated School", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-06"), postingEnd: new Date("2026-08-22"), salaryGrade: 11 },
      { id: crypto.randomUUID(), positionKey: "School Nurse II", itemNo: "NUR2-006", title: "School Nurse II", school: "Tondo HS", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-07"), postingEnd: new Date("2026-08-28"), salaryGrade: 15 }
    ];

    for (const vac of vacanciesData) {
      const pos = positionsData.find(p => p.title === vac.positionKey);
      await pool.query(
        `INSERT INTO vacancies (id, position_id, item_no, title, school, location, region, status, posting_start, posting_end, salary_grade)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [vac.id, pos.id, vac.itemNo, vac.title, vac.school, vac.location, vac.region, vac.status, vac.postingStart, vac.postingEnd, vac.salaryGrade]
      );
      vac.positionId = pos.id; // Map positionId for applicant generation
    }

    const addDays = (date, days) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };

    console.log("Seeding applicants and applications (103 items)...");
    for (let i = 1; i <= 103; i++) {
      const degree = degreePool[(i * 7) % degreePool.length];
      const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`;
      const vacancy = vacanciesData[(i - 1) % vacanciesData.length];
      const position = positionsData.find(p => p.id === vacancy.positionId);
      const yearsExperience = (i * 2 + (i % 5)) % 11;
      const trainingHours = (i * 13) % 121;
      const dateDay = String(1 + ((i * 3) % 28)).padStart(2, "0");
      const baseDateStr = `2026-07-${dateDay}`;
      const lateDate = addDays(vacancy.postingEnd, (i % 5) + 1);
      const dateApplied = i % 9 === 0 ? lateDate : new Date(baseDateStr);

      const fName = firstNames[i % firstNames.length];
      const lName = lastNames[(i * 3) % lastNames.length];
      const codeVal = `DUAN-2026-${String(100000 + i).padStart(6, "0")}`;

      const { rows: applicantRows } = await pool.query(
        `INSERT INTO applicants (surname, first_name, email_address, name, code, local_resident, bachelor_degree, major, years_experience, training_hours, eligibility, applicant_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [lName, fName, `applicant_${i}@deped.gov.ph`, name, codeVal, i % 3 !== 0, degree.degree, degree.major, yearsExperience, trainingHours, degree.elig, codeVal]
      );
      const applicantId = applicantRows[0].id;

      const isQualified = i % 17 === 0;
      const isDisqualified = i % 19 === 0;
      const status = isQualified ? "qualified" : (isDisqualified ? "disqualified" : "Application Submitted");

      const applicationId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO applications (id, application_number, vacancy_id, applicant_id, status, date_applied, documents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          applicationId,
          `APP-${String(i).padStart(3, "0")}`,
          vacancy.id,
          applicantId,
          status,
          dateApplied,
          JSON.stringify({ loi: true, pds: true, prc: i % 4 !== 0, tor: i % 5 !== 0, diploma: i % 6 !== 0, oss: i % 7 !== 0 })
        ]
      );

      // Add to application history
      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, applicationId, "Mock application submitted for QS simulation"]
      );

      const fit = computeFit(
        {
          bachelorDegree: degree.degree,
          major: degree.major,
          yearsExperience: Number(yearsExperience),
          trainingHours: Number(trainingHours),
          eligibility: degree.elig
        },
        {
          id: position.id,
          title: position.title,
          track: position.track,
          requiredBachelorDegree: position.requiredBachelorDegree,
          requiredDegreeKeywords: Array.isArray(position.requiredDegreeKeywords) ? position.requiredDegreeKeywords : (position.requiredDegreeKeywords ? position.requiredDegreeKeywords.split(',') : []),
          minYearsExperience: position.minYearsExperience,
          minTrainingHours: position.minTrainingHours,
          eligibilityRequired: position.eligibilityRequired
        }
      );

      const evalId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, degree_decision, experience_decision, training_decision, eligibility_decision, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          evalId,
          applicationId,
          fit.overall >= 60 ? "qualified_suggested" : "disqualified_suggested",
          fit.overall,
          fit.degreeScore,
          fit.experienceScore,
          fit.trainingScore,
          fit.eligibilityScore,
          fit.degreeScore >= 60 ? "pass" : "fail",
          fit.experienceScore >= 60 ? "pass" : "fail",
          fit.trainingScore >= 60 ? "pass" : "fail",
          fit.eligibilityScore >= 60 ? "pass" : "fail",
          `Mock QS score generated for ${position.title}: ${fit.recommendation}`
        ]
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

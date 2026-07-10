import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computeFit } from '@agap/shared';

const prisma = new PrismaClient();

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
  console.log("Starting SQLite database seed...");

  // Clean existing tables (SQLite safe order)
  await prisma.notification.deleteMany();
  await prisma.qualEval.deleteMany();
  await prisma.applicationHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.applicant.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.vacancy.deleteMany();
  await prisma.position.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const passwordHash = await bcrypt.hash("password", 10);
  const passcodeHash = await bcrypt.hash("123456", 10); // Standard confirmation passcode

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@deped.gov.ph",
      fullName: "System Administrator",
      passwordHash,
      passcodeHash,
      role: "admin",
      status: "active"
    }
  });

  const hrOfficer = await prisma.user.create({
    data: {
      username: "hr_officer",
      email: "hr@deped.gov.ph",
      fullName: "HR Officer",
      passwordHash,
      passcodeHash,
      role: "hr_officer",
      status: "active"
    }
  });

  console.log("Users created:", admin.username, hrOfficer.username);

  // Positions
  const positionsData = [
    { title: "Teacher I", track: "teacher_i", requiredBachelorDegree: "Bachelor of Elementary Education or Bachelor of Secondary Education", requiredDegreeKeywords: "education,elementary,secondary,teaching", minYearsExperience: 0, minTrainingHours: 0, eligibilityRequired: "LET / PRC License" },
    { title: "Master Teacher I", track: "higher_teaching", requiredBachelorDegree: "Bachelor in Education or relevant bachelor's degree", requiredDegreeKeywords: "education,teaching", minYearsExperience: 3, minTrainingHours: 24, eligibilityRequired: "LET / PRC License" },
    { title: "Head Teacher I", track: "school_leadership", requiredBachelorDegree: "Bachelor in Education with school leadership preparation", requiredDegreeKeywords: "education,teaching,leadership", minYearsExperience: 5, minTrainingHours: 40, eligibilityRequired: "LET / PRC License" },
    { title: "Administrative Officer II", track: "administrative", requiredBachelorDegree: "Bachelor in Business Administration, Public Administration, Accounting, or Management", requiredDegreeKeywords: "business,public administration,accounting,management", minYearsExperience: 1, minTrainingHours: 8, eligibilityRequired: "Career Service Professional" },
    { title: "Guidance Counselor I", track: "learner_support", requiredBachelorDegree: "Bachelor in Guidance and Counseling, Psychology, or Education", requiredDegreeKeywords: "guidance,counseling,psychology,education", minYearsExperience: 1, minTrainingHours: 16, eligibilityRequired: "RA 1080 / Guidance Counselor License" },
    { title: "School Nurse II", track: "health", requiredBachelorDegree: "Bachelor of Science in Nursing", requiredDegreeKeywords: "nursing", minYearsExperience: 1, minTrainingHours: 8, eligibilityRequired: "RA 1080 / Nursing License" }
  ];

  const positions = [];
  for (const pos of positionsData) {
    const created = await prisma.position.create({ data: pos });
    positions.push(created);
  }

  // Vacancies
  const vacanciesData = [
    { positionKey: "Teacher I", itemNo: "TCH1-001", title: "Teacher I - Elementary", school: "Rizal ES", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-08-15"), salaryGrade: 11 },
    { positionKey: "Master Teacher I", itemNo: "MT1-002", title: "Master Teacher I", school: "Manila Science HS", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-01"), postingEnd: new Date("2026-08-20"), salaryGrade: 18 },
    { positionKey: "Head Teacher I", itemNo: "HT1-003", title: "Head Teacher I", school: "Bonifacio ES", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-03"), postingEnd: new Date("2026-08-25"), salaryGrade: 14 },
    { positionKey: "Administrative Officer II", itemNo: "AO2-004", title: "Administrative Officer II", school: "SDO Manila", location: "Division Office", region: "NCR", status: "open", postingStart: new Date("2026-07-05"), postingEnd: new Date("2026-08-18"), salaryGrade: 11 },
    { positionKey: "Guidance Counselor I", itemNo: "GC1-005", title: "Guidance Counselor I", school: "Manila Integrated School", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-06"), postingEnd: new Date("2026-08-22"), salaryGrade: 11 },
    { positionKey: "School Nurse II", itemNo: "NUR2-006", title: "School Nurse II", school: "Tondo HS", location: "SDO Manila", region: "NCR", status: "open", postingStart: new Date("2026-07-07"), postingEnd: new Date("2026-08-28"), salaryGrade: 15 }
  ];

  const vacancies = [];
  for (const vac of vacanciesData) {
    const pos = positions.find(p => p.title === vac.positionKey);
    const { positionKey, ...data } = vac;
    const created = await prisma.vacancy.create({
      data: {
        ...data,
        positionId: pos.id
      }
    });
    vacancies.push(created);
  }

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  console.log("Seeding applicants and applications...");
  for (let i = 1; i <= 103; i++) {
    const degree = degreePool[(i * 7) % degreePool.length];
    const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`;
    const vacancy = vacancies[(i - 1) % vacancies.length];
    const position = positions.find(p => p.id === vacancy.positionId);
    const yearsExperience = (i * 2 + (i % 5)) % 11;
    const trainingHours = (i * 13) % 121;
    const dateDay = String(1 + ((i * 3) % 28)).padStart(2, "0");
    const baseDateStr = `2026-07-${dateDay}`;
    const lateDate = addDays(vacancy.postingEnd, (i % 5) + 1);
    const dateApplied = i % 9 === 0 ? lateDate : new Date(baseDateStr);

    const applicant = await prisma.applicant.create({
      data: {
        name,
        code: `DUAN-2026-${String(100000 + i).padStart(6, "0")}`,
        localResident: i % 3 !== 0,
        bachelorDegree: degree.degree,
        major: degree.major,
        yearsExperience,
        trainingHours,
        eligibility: degree.elig
      }
    });

    const isQualified = i % 17 === 0;
    const isDisqualified = i % 19 === 0;
    const status = isQualified ? "qualified" : (isDisqualified ? "disqualified" : "pending");

    const application = await prisma.application.create({
      data: {
        applicationNumber: `APP-${String(i).padStart(3, "0")}`,
        vacancyId: vacancy.id,
        applicantId: applicant.id,
        status,
        dateApplied,
        documents: JSON.stringify({ loi: true, pds: true, prc: i % 4 !== 0, tor: i % 5 !== 0, diploma: i % 6 !== 0, oss: i % 7 !== 0 }),
        history: {
          create: [
            { text: "Mock application submitted for QS simulation" }
          ]
        }
      }
    });

    const fit = computeFit(
      {
        bachelorDegree: applicant.bachelorDegree,
        major: applicant.major,
        yearsExperience: Number(applicant.yearsExperience),
        trainingHours: Number(applicant.trainingHours),
        eligibility: applicant.eligibility
      },
      {
        ...position,
        requiredDegreeKeywords: position.requiredDegreeKeywords.split(',')
      }
    );

    await prisma.qualEval.create({
      data: {
        applicationId: application.id,
        result: fit.overall >= 60 ? "qualified_suggested" : "disqualified_suggested",
        overallFit: fit.overall,
        degreeScore: fit.degreeScore,
        experienceScore: fit.experienceScore,
        trainingScore: fit.trainingScore,
        eligibilityScore: fit.eligibilityScore,
        degreeDecision: fit.degreeScore >= 60 ? "pass" : "fail",
        experienceDecision: fit.experienceScore >= 60 ? "pass" : "fail",
        trainingDecision: fit.trainingScore >= 60 ? "pass" : "fail",
        eligibilityDecision: fit.eligibilityScore >= 60 ? "pass" : "fail",
        remarks: `Mock QS score generated for ${position.title}: ${fit.recommendation}`
      }
    });
  }

  console.log("Database seed successfully completed!");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

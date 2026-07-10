export const DOCS = {
  loi: "Letter of Intent",
  pds: "PDS",
  wes: "Work Experience Sheet",
  prc: "PRC License",
  tor: "TOR",
  diploma: "Diploma",
  oss: "Omnibus Sworn Statement"
};

export const DOC_REQUIREMENTS = [
  { key: "loi", label: "Letter of intent addressed to the Head of Office or highest human resource officer" },
  { key: "pds", label: "Duly accomplished Personal Data Sheet (PDS, CS Form No. 212, Revised 2017) and Work Experience Sheet, if applicable" },
  { key: "prc", label: "Photocopy of valid and updated PRC License/ID, if applicable" },
  { key: "eligibility", label: "Photocopy of Certificate of Eligibility/Report of Rating, if applicable" },
  { key: "tor", label: "Photocopy of scholastic/academic records such as Transcript of Records (TOR) and Diploma, including graduate and post-graduate units/degrees, if available" },
  { key: "training", label: "Photocopy of Certificate/s of Training, if applicable" },
  { key: "employment", label: "Photocopy of Certificate of Employment, Contract of Service, or duly signed Service Record, whichever is/are applicable" },
  { key: "appointment", label: "Photocopy of latest appointment, if applicable" },
  { key: "performance", label: "Photocopy of the Performance Rating in the last rating period(s) covering one (1) year performance prior to the deadline of submission, if applicable" },
  { key: "cav", label: "Checklist of Requirements and Omnibus Sworn Statement on the CAV of documents submitted and Data Privacy Consent Form" },
  { key: "other", label: "Other documents as may be required for comparative assessment (e.g. MOVs, or Performance Rating from relevant work experience)" }
];

export const SCORE_AREAS = [
  { key: "education", label: "Education", description: "Match between applicant degree/education and required education, based on the prescribed scoring mechanism and increments table." },
  { key: "experience", label: "Experience", description: "Match between work experience and required years/type of experience, based on the prescribed scoring mechanism and increments table." },
  { key: "training", label: "Training", description: "Match between completed training and required training hours/topics, based on the prescribed scoring mechanism and increments table." },
  { key: "eligibility", label: "Eligibility", description: "Match between license, eligibility, or certification and the position requirement based on the submitted MOV for eligibility." },
  { key: "outstandingAccomplishment", label: "Outstanding Accomplishment", description: "Score based on submitted proofs of outstanding accomplishments under the prescribed criteria." },
  { key: "documentCompleteness", label: "Document Completeness", description: "Whether required credentials and files are complete, with corresponding scores under the prescribed criteria." },
  { key: "applicationEducation", label: "Application of Education", description: "Score based on the application of education to the role under the prescribed criteria." },
  { key: "applicationLearning", label: "Application of Learning and Development", description: "Score based on the application of learning and development under the prescribed criteria." },
  { key: "performanceRating", label: "Performance Rating", description: "Score based on the applicable performance-rating mechanism and criteria." },
  { key: "potential", label: "Potential", description: "Measured using other evaluative assessments such as WST, WE, and BEI." }
];

export const columns = [
  ["rowNo", "No."],
  ["applicant", "Applicant"],
  ["dateApplied", "Date of Application"],
  ["deadline", "Deadline of Application"],
  ["bachelorDegree", "Bachelor’s Degree"],
  ["yearsExperience", "Years Experience"],
  ["trainingHours", "Hours Training"],
  ["vacancy", "Vacancy"],
  ["itemNo", "Item No."],
  ["status", "Application Status"]
];

export const columnTypes = {
  yearsExperience: "numeric",
  trainingHours: "numeric",
  vacancy: "categorical",
  status: "categorical"
};

export function computeFit(applicant, position) {
  const degree = (applicant.bachelorDegree || "").toLowerCase();
  const keywords = position.requiredDegreeKeywords || [];
  const hasBachelor = degree.includes("bachelor");
  const keywordMatch = keywords.some(k => degree.includes(k));
  const degreeScore = keywordMatch ? 100 : hasBachelor ? 75 : 20;

  const minExp = Number(position.minYearsExperience || 0);
  const exp = Number(applicant.yearsExperience || 0);
  const experienceScore = minExp === 0 ? 100 : Math.min(100, Math.round(exp / minExp * 100));

  const minTraining = Number(position.minTrainingHours || 0);
  const training = Number(applicant.trainingHours || 0);
  const trainingScore = minTraining === 0 ? 100 : Math.min(100, Math.round(training / minTraining * 100));

  const requiredElig = (position.eligibilityRequired || "").toLowerCase();
  const elig = (applicant.eligibility || "").toLowerCase();
  const eligibilityScore = requiredElig ? ((elig.includes("let") || elig.includes("prc")) ? 100 : 25) : 100;

  const overall = Math.round((degreeScore * .35) + (experienceScore * .25) + (trainingScore * .20) + (eligibilityScore * .20));
  return {
    degreeScore,
    experienceScore,
    trainingScore,
    eligibilityScore,
    overall,
    recommendation: overall >= 85 ? "Strong fit" : overall >= 70 ? "Good fit" : overall >= 50 ? "Partial fit" : "Low fit"
  };
}

export function goodness(score) {
  if (score >= 90) return { label: "Excellent fit", color: "green" };
  if (score >= 75) return { label: "Strong fit", color: "green" };
  if (score >= 60) return { label: "Moderate fit", color: "blue" };
  if (score >= 40) return { label: "Limited fit", color: "orange" };
  return { label: "Poor fit", color: "red" };
}

export function scoreTone(score) {
  if (score === "" || score === null || score === undefined || !Number.isFinite(Number(score))) return { label: "Not scored", color: "gray" };
  const n = Number(score);
  if (n >= 90) return { label: "Excellent fit", color: "green" };
  if (n >= 75) return { label: "Strong fit", color: "green" };
  if (n >= 60) return { label: "Moderate fit", color: "blue" };
  if (n >= 40) return { label: "Limited fit", color: "orange" };
  return { label: "Poor fit", color: "red" };
}

export function computeOverallAreaScore(scores) {
  const values = Object.values(scores).filter(v => v !== "" && Number.isFinite(Number(v)));
  return values.length ? Number((values.reduce((sum, v) => sum + Number(v), 0) / values.length).toFixed(2)) : 0;
}

export function cls(s) {
  return { open: "green", pending: "blue", pending_qs_review: "blue", qualified: "green", disqualified: "red", excluded: "gray", for_comparative_assessment: "blue" }[s] || "gray";
}

export function titleCase(s) {
  if (s === "pending_qs_review") return "Pending QS Review";
  return String(s || "").replaceAll("_", " ").replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function nullifyPipelineIfDisqualified(app) {
  if (!app || app.status !== "disqualified") return;
  app.assessmentStatus = null;
  app.comparativeAssessmentScores = null;
  app.appointmentStatus = null;
  app.appointmentDate = null;
  app.appointmentItemNo = null;
  app.appointmentReferenceCode = null;
}

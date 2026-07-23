import { pool } from '../../config/db.js';
import { computeFit } from '@agap/shared';

export async function getHydratedApplications(vacancyId = null, region = null, division = null) {
  let query = `
    SELECT 
      a.*,
      a.job_cluster_id as vacancy_id,
      CONCAT_WS(' ', NULLIF(ap.first_name, ''), NULLIF(ap.middle_name, ''), NULLIF(ap.surname, '')) as applicant_name,
      COALESCE(ap.code, ap.applicant_number) as applicant_code,
      ap.local_resident as applicant_local_resident,
      ap.bachelor_degree as applicant_bachelor_degree,
      ap.major as applicant_major,
      ap.years_experience as applicant_years_experience,
      ap.training_hours as applicant_training_hours,
      ap.eligibility as applicant_eligibility,
      ap.educational_background as applicant_educational_background,
      ap.civil_service_eligibility as applicant_civil_service_eligibility,
      ap.residential_address as applicant_residential_address,
      ap.permanent_address as applicant_permanent_address,
      ap.date_of_birth as applicant_date_of_birth,
      ap.sex as applicant_sex,
      ap.civil_status as applicant_civil_status,
      ap.religion as applicant_religion,
      ap.disability as applicant_disability,
      ap.ethnic_group as applicant_ethnic_group,
      ap.email_address as applicant_email_address,
      ap.mobile_no as applicant_mobile_no,
      ap.telephone_no as applicant_telephone_no,
      ap.age as applicant_age,
      p.title as vacancy_title,
      a.appointment_item_no as vacancy_item_no,
      jc.division as vacancy_division,
      v.school as vacancy_school,
      v.salary_grade as vacancy_salary_grade,
      v.posting_end as vacancy_posting_end,
      v.status as vacancy_status,
      p.id as position_id,
      p.title as position_title,
      p.track as position_track,
      p.required_bachelor_degree as position_required_bachelor_degree,
      p.required_degree_keywords as position_required_degree_keywords,
      p.years_experience as position_min_years_experience,
      p.training_hours as position_min_training_hours,
      p.eligibility_required as position_eligibility_required,
      (
        SELECT COALESCE(json_agg(h ORDER BY h.at DESC), '[]'::json)
        FROM application_history h 
        WHERE h.application_id = a.id
      ) as history,
      (
        SELECT COALESCE(json_agg(q ORDER BY q.at DESC), '[]'::json)
        FROM qual_evals q 
        WHERE q.application_id = a.id
      ) as qual_evals
    FROM applicants ap
    INNER JOIN applications a ON a.applicant_id = ap.id
    LEFT JOIN job_clusters jc ON a.job_cluster_id = jc.id
    LEFT JOIN positions p ON jc.position_id = p.id
    LEFT JOIN (
      SELECT DISTINCT ON (job_cluster_id) * 
      FROM vacancies 
      ORDER BY job_cluster_id, created_at ASC
    ) v ON a.job_cluster_id = v.job_cluster_id
  `;
  
  const values = [];
  const clauses = [];
  if (vacancyId) {
    values.push(vacancyId);
    clauses.push(`a.job_cluster_id = $${values.length}`);
  }
  if (region) {
    values.push(region);
    clauses.push(`v.region = $${values.length}`);
  }
  if (division) {
    values.push(division);
    clauses.push(`v.division = $${values.length}`);
  }

  if (clauses.length > 0) {
    query += ` WHERE ` + clauses.join(' AND ');
  }

  const { rows } = await pool.query(query, values);

  return rows.map(row => {
    let parsedDocs = {};
    if (typeof row.documents === 'object' && row.documents !== null) {
      parsedDocs = row.documents;
    } else {
      try { parsedDocs = JSON.parse(row.documents || '{}'); } catch(e){}
    }

    let parsedChecklist = null;
    if (row.doc_checklist) {
      if (typeof row.doc_checklist === 'object') {
        parsedChecklist = row.doc_checklist;
      } else {
        try { parsedChecklist = JSON.parse(row.doc_checklist); } catch(e){}
      }
    }

    let parsedCompScores = null;
    if (row.comparative_assessment_scores) {
      if (typeof row.comparative_assessment_scores === 'object') {
        parsedCompScores = row.comparative_assessment_scores;
      } else {
        try { parsedCompScores = JSON.parse(row.comparative_assessment_scores); } catch(e){}
      }
    }

    let eduBg = [];
    if (row.applicant_educational_background) {
      if (typeof row.applicant_educational_background === 'object') {
        eduBg = row.applicant_educational_background;
      } else {
        try { eduBg = JSON.parse(row.applicant_educational_background || '[]'); } catch(e){}
      }
    }
    const collegeBg = Array.isArray(eduBg) ? eduBg.find(e => String(e.level).toUpperCase() === 'COLLEGE') : null;
    const fallbackDegree = collegeBg ? collegeBg.degree : null;
    const fallbackMajor = collegeBg ? collegeBg.major || collegeBg.units : null;

    let civilSvc = [];
    if (row.applicant_civil_service_eligibility) {
      if (typeof row.applicant_civil_service_eligibility === 'object') {
        civilSvc = row.applicant_civil_service_eligibility;
      } else {
        try { civilSvc = JSON.parse(row.applicant_civil_service_eligibility || '[]'); } catch(e){}
      }
    }
    const fallbackEligibility = Array.isArray(civilSvc) ? civilSvc.map(c => c.eligibility).filter(Boolean).join(', ') : null;

    const bachelorDegree = row.applicant_bachelor_degree || fallbackDegree || '';
    const major = row.applicant_major || fallbackMajor || '';
    const eligibility = row.applicant_eligibility || fallbackEligibility || '';

    const fitBase = computeFit(
      {
        bachelorDegree: bachelorDegree,
        major: major,
        yearsExperience: Number(row.applicant_years_experience || 0),
        trainingHours: Number(row.applicant_training_hours || 0),
        eligibility: eligibility
      },
      {
        id: row.position_id,
        title: row.position_title,
        track: row.position_track,
        requiredBachelorDegree: row.position_required_bachelor_degree,
        requiredDegreeKeywords: Array.isArray(row.position_required_degree_keywords) ? row.position_required_degree_keywords : (row.position_required_degree_keywords ? row.position_required_degree_keywords.split(',') : []),
        minYearsExperience: row.position_min_years_experience,
        minTrainingHours: row.position_min_training_hours,
        eligibilityRequired: row.position_eligibility_required
      }
    );

    const qualEvalsArray = row.qual_evals || [];
    const absoluteLatest = qualEvalsArray[0] || null;
    const latestQsEval = qualEvalsArray.find(q => q.degree_decision !== null) || absoluteLatest;

    let parsedAreaScores = {};
    if (absoluteLatest && absoluteLatest.area_scores) {
      if (typeof absoluteLatest.area_scores === 'object') {
        parsedAreaScores = absoluteLatest.area_scores;
      } else {
        try { parsedAreaScores = JSON.parse(absoluteLatest.area_scores); } catch(e){}
      }
    }

    const overallFit = absoluteLatest && absoluteLatest.overall_fit !== null ? Number(absoluteLatest.overall_fit) : fitBase.overall;

    return {
      id: row.id || `unapplied-${row.applicant_id || Math.random()}`,
      applicant: row.applicant_name,
      code: row.applicant_code,
      dateApplied: row.date_applied ? new Date(row.date_applied).toISOString().slice(0,10) : "",
      deadline: row.vacancy_posting_end ? new Date(row.vacancy_posting_end).toISOString().slice(0,10) : "",
      bachelorDegree: bachelorDegree,
      yearsExperience: Number(row.applicant_years_experience || 0),
      trainingHours: Number(row.applicant_training_hours || 0),
      vacancy: row.vacancy_title || "—",
      itemNo: row.vacancy_item_no || null,
      division: row.vacancy_division || row.vacancy_school || "—",
      school: row.vacancy_school || "—",
      salaryGrade: row.vacancy_salary_grade || "—",
      qsDegree: row.position_required_bachelor_degree || "No degree specified",
      qsExperience: `${row.position_min_years_experience || 0} minimum year(s)`,
      qsTraining: `${row.position_min_training_hours || 0} minimum hour(s)`,
      qsEligibility: row.position_eligibility_required || "Not specified",
      status: row.status || "No Application",
      appointmentStatus: row.appointment_status || null,
      appointmentReferenceCode: row.appointment_reference_code || null,
      appointmentDate: row.appointment_date ? new Date(row.appointment_date).toISOString() : null,
      vacancyId: row.vacancy_id || null,
      jobClusterId: row.vacancy_id || null,
      positionTitle: row.position_title || row.vacancy_title || "—",
      fit: overallFit,
      applicantObj: {
        id: row.applicant_id,
        name: row.applicant_name,
        code: row.applicant_code,
        localResident: row.applicant_local_resident,
        bachelorDegree: bachelorDegree,
        major: major,
        yearsExperience: row.applicant_years_experience,
        trainingHours: row.applicant_training_hours,
        eligibility: eligibility,
        residential_address: row.applicant_residential_address,
        permanent_address: row.applicant_permanent_address,
        date_of_birth: row.applicant_date_of_birth,
        sex: row.applicant_sex,
        civil_status: row.applicant_civil_status,
        religion: row.applicant_religion,
        disability: row.applicant_disability,
        ethnic_group: row.applicant_ethnic_group,
        email_address: row.applicant_email_address,
        mobile_no: row.applicant_mobile_no,
        telephone_no: row.applicant_telephone_no,
        age: row.applicant_age
      },
      vacancyObj: {
        id: row.vacancy_id,
        positionId: row.position_id,
        itemNo: row.vacancy_item_no,
        title: row.vacancy_title,
        school: row.vacancy_school,
        division: row.vacancy_division,
        region: 'NCR',
        status: row.vacancy_status,
        postingEnd: row.vacancy_posting_end
      },
      positionObj: {
        id: row.position_id,
        title: row.position_title,
        track: row.position_track,
        requiredBachelorDegree: row.position_required_bachelor_degree,
        requiredDegreeKeywords: row.position_required_degree_keywords,
        minYearsExperience: row.position_min_years_experience,
        minTrainingHours: row.position_min_training_hours,
        eligibilityRequired: row.position_eligibility_required
      },
      fitObj: {
        ...fitBase,
        overall: overallFit,
        manualScores: parsedAreaScores
      },
      latestEval: latestQsEval ? {
        id: latestQsEval.id,
        applicationId: latestQsEval.application_id,
        result: latestQsEval.result,
        overallFit: latestQsEval.overall_fit,
        degreeScore: latestQsEval.degree_score,
        experienceScore: latestQsEval.experience_score,
        trainingScore: latestQsEval.training_score,
        eligibilityScore: latestQsEval.eligibility_score,
        degreeDecision: latestQsEval.degree_decision,
        experienceDecision: latestQsEval.experience_decision,
        trainingDecision: latestQsEval.training_decision,
        eligibilityDecision: latestQsEval.eligibility_decision,
        documentaryComplete: latestQsEval.documentary_complete,
        remarks: latestQsEval.remarks,
        areaScores: parsedAreaScores,
        createdAt: latestQsEval.at,
        updatedAt: latestQsEval.at
      } : null,
      history: row.history || [],
      documents: parsedDocs,
      documentaryComplete: row.documentary_complete,
      docChecklist: parsedChecklist,
      reason: row.reason,
      assessmentStatus: row.assessment_status,
      applicationStatus: row.application_status || row.status,
      comparativeAssessmentScores: parsedCompScores,
      appointmentStatus: row.appointment_status,
      appointmentReferenceCode: row.appointment_reference_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

import { pool } from '../../config/db.js';
import { computeFit } from '@agap/shared';

export async function getHydratedApplications(vacancyId = null) {
  let query = `
    SELECT 
      a.*,
      COALESCE(ap.name, ap.first_name || ' ' || ap.surname) as applicant_name,
      COALESCE(ap.code, ap.applicant_number) as applicant_code,
      ap.local_resident as applicant_local_resident,
      ap.bachelor_degree as applicant_bachelor_degree,
      ap.major as applicant_major,
      ap.years_experience as applicant_years_experience,
      ap.training_hours as applicant_training_hours,
      ap.eligibility as applicant_eligibility,
      v.title as vacancy_title,
      v.item_no as vacancy_item_no,
      v.location as vacancy_location,
      v.school as vacancy_school,
      v.salary_grade as vacancy_salary_grade,
      v.posting_end as vacancy_posting_end,
      v.status as vacancy_status,
      p.id as position_id,
      p.title as position_title,
      p.track as position_track,
      p.required_bachelor_degree as position_required_bachelor_degree,
      p.required_degree_keywords as position_required_degree_keywords,
      p.min_years_experience as position_min_years_experience,
      p.min_training_hours as position_min_training_hours,
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
    LEFT JOIN vacancies v ON a.vacancy_id = v.id
    LEFT JOIN positions p ON v.position_id = p.id
  `;
  
  const values = [];
  if (vacancyId) {
    query += ` WHERE a.vacancy_id = $1`;
    values.push(vacancyId);
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

    const fitBase = computeFit(
      {
        bachelorDegree: row.applicant_bachelor_degree,
        major: row.applicant_major,
        yearsExperience: Number(row.applicant_years_experience || 0),
        trainingHours: Number(row.applicant_training_hours || 0),
        eligibility: row.applicant_eligibility
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
    const latestEval = qualEvalsArray[0] || null;
    let parsedAreaScores = {};
    if (latestEval && latestEval.area_scores) {
      if (typeof latestEval.area_scores === 'object') {
        parsedAreaScores = latestEval.area_scores;
      } else {
        try { parsedAreaScores = JSON.parse(latestEval.area_scores); } catch(e){}
      }
    }

    const overallFit = latestEval && latestEval.overall_fit !== null ? Number(latestEval.overall_fit) : fitBase.overall;

    return {
      id: row.id || `unapplied-${row.applicant_id || Math.random()}`,
      applicant: row.applicant_name,
      code: row.applicant_code,
      dateApplied: row.date_applied ? new Date(row.date_applied).toISOString().slice(0,10) : "",
      deadline: row.vacancy_posting_end ? new Date(row.vacancy_posting_end).toISOString().slice(0,10) : "",
      bachelorDegree: row.applicant_bachelor_degree,
      yearsExperience: Number(row.applicant_years_experience || 0),
      trainingHours: Number(row.applicant_training_hours || 0),
      vacancy: row.vacancy_title || "—",
      itemNo: row.vacancy_item_no || null,
      location: row.vacancy_location || row.vacancy_school || "—",
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
      fit: overallFit,
      applicantObj: {
        id: row.applicant_id,
        name: row.applicant_name,
        code: row.applicant_code,
        localResident: row.applicant_local_resident,
        bachelorDegree: row.applicant_bachelor_degree,
        major: row.applicant_major,
        yearsExperience: row.applicant_years_experience,
        trainingHours: row.applicant_training_hours,
        eligibility: row.applicant_eligibility
      },
      vacancyObj: {
        id: row.vacancy_id,
        positionId: row.position_id,
        itemNo: row.vacancy_item_no,
        title: row.vacancy_title,
        school: row.vacancy_school,
        location: row.vacancy_location,
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
      latestEval: latestEval ? {
        id: latestEval.id,
        applicationId: latestEval.application_id,
        result: latestEval.result,
        overallFit: latestEval.overall_fit,
        degreeScore: latestEval.degree_score,
        experienceScore: latestEval.experience_score,
        trainingScore: latestEval.training_score,
        eligibilityScore: latestEval.eligibility_score,
        degreeDecision: latestEval.degree_decision,
        experienceDecision: latestEval.experience_decision,
        trainingDecision: latestEval.training_decision,
        eligibilityDecision: latestEval.eligibility_decision,
        documentaryComplete: latestEval.documentary_complete,
        remarks: latestEval.remarks,
        areaScores: parsedAreaScores,
        createdAt: latestEval.at,
        updatedAt: latestEval.at
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

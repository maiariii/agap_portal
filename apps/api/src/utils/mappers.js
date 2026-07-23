export function mapPosition(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    track: row.track,
    requiredBachelorDegree: row.required_bachelor_degree,
    requiredDegreeKeywords: Array.isArray(row.required_degree_keywords) ? row.required_degree_keywords : (row.required_degree_keywords ? row.required_degree_keywords.split(',') : []),
    minYearsExperience: row.min_years_experience !== undefined ? row.min_years_experience : row.years_experience,
    minTrainingHours: row.min_training_hours !== undefined ? row.min_training_hours : row.training_hours,
    eligibilityRequired: row.eligibility_required,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export function mapVacancy(row) {
  if (!row) return null;
  return {
    id: row.id,
    positionId: row.position_id,
    itemNo: row.item_no,
    title: row.title,
    school: row.school,
    division: row.division,
    region: row.region,
    status: row.status,
    schoolLevel: row.school_level,
    schoolId: row.school_id,
    fillingUpStatus: row.filling_up_status || 'UNFILLED',
    postingStart: row.posting_start ? new Date(row.posting_start) : null,
    postingEnd: row.posting_end ? new Date(row.posting_end) : null,
    salaryGrade: row.salary_grade,
    jobClusterId: row.job_cluster_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

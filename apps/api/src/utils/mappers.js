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

function formatDateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dt);
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
    postingStart: formatDateOnly(row.posting_start),
    postingEnd: formatDateOnly(row.posting_end),
    salaryGrade: row.salary_grade,
    jobClusterId: row.job_cluster_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

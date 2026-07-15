import { pool } from '../../config/db.js';
import { getHydratedApplications } from './apps.service.js';
import crypto from 'crypto';

export async function getApplications(req, res) {
  try {
    const list = await getHydratedApplications();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function reviewApplication(req, res) {
  const { id } = req.params;
  const {
    result,
    docsComplete,
    docChecklist,
    remarks,
    overallFit,
    degreeScore,
    experienceScore,
    trainingScore,
    eligibilityScore,
    degreeDecision,
    experienceDecision,
    trainingDecision,
    eligibilityDecision,
    areaScores
  } = req.body;

  try {
    const { rows: appRows } = await pool.query('SELECT appointment_status, assessment_status, status FROM applications WHERE id = $1', [id]);
    const app = appRows[0];
    if (app) {
      const apptLower = (app.appointment_status || '').toLowerCase();
      if (apptLower === 'appointed' || apptLower === 'rejected' || apptLower === 'not appointed' || apptLower === 'not_appointed') {
        return res.status(400).json({ error: 'Cannot modify evaluation once appointment is recorded.' });
      }
      if (app.assessment_status === 'Assessment Started' || app.assessment_status === 'Assessment Completed') {
        return res.status(400).json({ error: 'Cannot modify evaluation once assessment has started.' });
      }
    }

    const evalId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, degree_decision, experience_decision, training_decision, eligibility_decision, documentary_complete, remarks, area_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        evalId,
        id,
        result,
        overallFit ? parseFloat(overallFit) : null,
        degreeScore ? parseFloat(degreeScore) : null,
        experienceScore ? parseFloat(experienceScore) : null,
        trainingScore ? parseFloat(trainingScore) : null,
        eligibilityScore ? parseFloat(eligibilityScore) : null,
        degreeDecision || null,
        experienceDecision || null,
        trainingDecision || null,
        eligibilityDecision || null,
        docsComplete,
        remarks || null,
        areaScores ? JSON.stringify(areaScores) : null
      ]
    );

    const fields = ['status = $1', 'application_status = $2', 'documentary_complete = $3', 'doc_checklist = $4', 'updated_at = NOW()'];
    const values = [result, result, docsComplete, docChecklist ? JSON.stringify(docChecklist) : null];
    let idx = 5;

    if (remarks) {
      fields.push(`reason = $${idx++}`);
      values.push(remarks);
    }

    if (result && result.toLowerCase() === 'qualified') {
      if (!app || !app.assessment_status || app.assessment_status === 'Assessment Not Started') {
        fields.push(`assessment_status = $${idx++}`);
        values.push('Assessment Not Started');
      }
    } else if (result && result.toLowerCase() === 'disqualified') {
      fields.push(`assessment_status = NULL`);
      fields.push(`comparative_assessment_scores = NULL`);
      fields.push(`appointment_status = NULL`);
      fields.push(`appointment_date = NULL`);
      fields.push(`appointment_item_no = NULL`);
      fields.push(`appointment_reference_code = NULL`);
    }

    values.push(id);
    const appQuery = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${idx}`;
    await pool.query(appQuery, values);

    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Saved documentary requirements / QS evaluation status as ${result}`]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function postIer(req, res) {
  const { vacancyId } = req.body;
  try {
    const { rows: apps } = await pool.query(
      "SELECT id FROM applications WHERE vacancy_id = $1 AND LOWER(status) = 'qualified'",
      [vacancyId]
    );

    for (const app of apps) {
      await pool.query(
        "UPDATE applications SET status = 'for_comparative_assessment', updated_at = NOW() WHERE id = $1",
        [app.id]
      );

      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, app.id, 'IER posted; moved to comparative assessment']
      );
    }

    res.json({ success: true, count: apps.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updatePipeline(req, res) {
  const { id } = req.params;
  const { assessmentStatus, comparativeAssessmentScores, status, areaScores, overallFit } = req.body;
  try {
    const { rows } = await pool.query('SELECT status, appointment_status, assessment_status FROM applications WHERE id = $1', [id]);
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const apptLower = (currentApp.appointment_status || '').toLowerCase();
    if (apptLower === 'appointed' || apptLower === 'rejected' || apptLower === 'not appointed' || apptLower === 'not_appointed') {
      return res.status(400).json({ error: 'Cannot modify assessment once appointment is recorded.' });
    }

    if (assessmentStatus !== undefined) {
      const statusOrder = {
        'Assessment Not Started': 1,
        'Assessment Started': 2,
        'Assessment Completed': 3
      };
      const currentOrder = statusOrder[currentApp.assessment_status] || 0;
      const newOrder = statusOrder[assessmentStatus] || 0;
      if (newOrder < currentOrder) {
        return res.status(400).json({ error: 'Assessment status cannot move backward.' });
      }
    }

    const updatedStatus = status || currentApp.status;

    const fields = ['updated_at = NOW()'];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (assessmentStatus !== undefined) {
      fields.push(`assessment_status = $${idx++}`);
      values.push(assessmentStatus);
    }
    if (comparativeAssessmentScores !== undefined) {
      fields.push(`comparative_assessment_scores = $${idx++}`);
      values.push(comparativeAssessmentScores ? JSON.stringify(comparativeAssessmentScores) : null);
    }

    values.push(id);
    const appQuery = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${idx}`;
    await pool.query(appQuery, values);

    if (areaScores) {
      const evalId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO qual_evals (id, application_id, result, overall_fit, degree_score, experience_score, training_score, eligibility_score, area_scores, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          evalId,
          id,
          updatedStatus,
          overallFit ? parseFloat(overallFit) : null,
          areaScores.education ? parseFloat(areaScores.education) : null,
          areaScores.experience ? parseFloat(areaScores.experience) : null,
          areaScores.training ? parseFloat(areaScores.training) : null,
          areaScores.eligibility ? parseFloat(areaScores.eligibility) : null,
          JSON.stringify(areaScores),
          "Qualified modal scoring metrics saved"
        ]
      );
    }
    
    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Pipeline stage updated. Status: ${status || 'unchanged'}, Assessment: ${assessmentStatus || 'unchanged'}`]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function confirmAppointment(req, res) {
  const { id } = req.params;
  const { appointmentDate, appointmentReferenceCode } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT a.*, v.item_no as vacancy_item_no 
       FROM applications a 
       JOIN vacancies v ON a.vacancy_id = v.id 
       WHERE a.id = $1`,
      [id]
    );
    const currentApp = rows[0];

    if (!currentApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { rows: occupiedRows } = await pool.query(
      `SELECT a.id FROM applications a
       JOIN vacancies v ON a.vacancy_id = v.id
       WHERE v.item_no = $1 AND a.appointment_status = 'appointed' AND a.id <> $2 LIMIT 1`,
      [currentApp.vacancy_item_no, id]
    );
    const occupiedApp = occupiedRows[0];

    if (occupiedApp) {
      await pool.query(
        `UPDATE applications 
         SET appointment_status = 'not_appointed', 
             appointment_date = $1, appointment_item_no = $2, appointment_reference_code = $3, updated_at = NOW()
         WHERE id = $4`,
        [
          appointmentDate ? new Date(appointmentDate) : null,
          currentApp.vacancy_item_no,
          appointmentReferenceCode || null,
          id
        ]
      );

      const historyId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [historyId, id, `Not Appointed: Item ${currentApp.vacancy_item_no} is already occupied by another appointed applicant.`]
      );

      return res.json({ success: true, occupied: true });
    }

    await pool.query(
      `UPDATE applications 
       SET appointment_status = 'appointed', 
           appointment_date = $1, appointment_item_no = $2, appointment_reference_code = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        new Date(appointmentDate),
        currentApp.vacancy_item_no,
        appointmentReferenceCode,
        id
      ]
    );

    // Update vacancy status to closed and filling_up_status to FILLED
    await pool.query(
      `UPDATE vacancies 
       SET status = 'closed', filling_up_status = 'FILLED', updated_at = NOW() 
       WHERE id = $1`,
      [currentApp.vacancy_id]
    );

    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
      [historyId, id, `Appointed to item ${currentApp.vacancy_item_no}. Reference: ${appointmentReferenceCode}`]
    );

    const { rows: otherApps } = await pool.query(
      `SELECT id FROM applications 
       WHERE vacancy_id = $1 AND id <> $2 AND LOWER(status) IN ('qualified', 'for_comparative_assessment', 'not_appointed')`,
      [currentApp.vacancy_id, id]
    );

    for (const otherApp of otherApps) {
      await pool.query(
        `UPDATE applications 
         SET appointment_status = 'not_appointed', 
             reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [`Item ${currentApp.vacancy_item_no} filled by another applicant`, otherApp.id]
      );

      const otherHistoryId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO application_history (id, application_id, text) VALUES ($1, $2, $3)`,
        [otherHistoryId, otherApp.id, `Not Appointed: Item ${currentApp.vacancy_item_no} filled by another applicant`]
      );
    }

    res.json({ success: true, occupied: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

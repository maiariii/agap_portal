import { pool } from '../../config/db.js';
import ExcelJS from 'exceljs';

/**
 * Fetch all reclassification applications with applicant details
 */
export async function getReclassApplications(req, res) {
  try {
    const { status, division, search } = req.query;

    let query = `
      SELECT 
        ra.id,
        ra.application_number,
        ra.applicant_id,
        ra.employee_id,
        ra.position_title,
        ra.item_number,
        ra.station_division,
        ra.date_originally_submitted,
        ra.proposed_qs_eval_result,
        ra.csc_approved_qs_eval_result,
        ra.evaluation_status,
        ra.has_updated_credentials,
        ra.updated_credentials_submitted_at,
        ra.documents,
        ra.reevaluation_timestamp,
        ra.dbm_export_timestamp,
        ra.created_at,
        ra.updated_at,
        COALESCE(
          TRIM(CONCAT(a.first_name, ' ', a.surname)),
          CONCAT('Applicant ', ra.application_number)
        ) AS applicant_name,
        COALESCE(a.email_address, 'applicant@deped.gov.ph') AS applicant_email
      FROM reclassification_applications ra
      LEFT JOIN applicants a ON ra.applicant_id = a.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      query += ` AND ra.evaluation_status = $${params.length}`;
    }

    if (division) {
      params.push(`%${division}%`);
      query += ` AND ra.station_division ILIKE $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        ra.application_number ILIKE $${params.length} OR
        ra.position_title ILIKE $${params.length} OR
        ra.station_division ILIKE $${params.length} OR
        a.first_name ILIKE $${params.length} OR
        a.surname ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY ra.date_originally_submitted DESC, ra.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('[Reclass Controller - getReclassApplications]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reclassification applications' });
  }
}

/**
 * Create or import a reclassification application
 */
export async function createReclassApplication(req, res) {
  try {
    const {
      application_number,
      applicant_id,
      position_title,
      item_number,
      station_division,
      proposed_qs_eval_result,
      documents
    } = req.body;

    if (!position_title) {
      return res.status(400).json({ error: 'Position title is required' });
    }

    const appNum = application_number || `REC-${Date.now()}`;
    const userDivision = req.user?.division || 'SDO Main';
    const finalDivision = station_division || userDivision;

    const insertQuery = `
      INSERT INTO reclassification_applications (
        application_number,
        applicant_id,
        employee_id,
        position_title,
        item_number,
        station_division,
        date_originally_submitted,
        proposed_qs_eval_result,
        csc_approved_qs_eval_result,
        evaluation_status,
        documents
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'Pending CSC Review', 'pending_reevaluation', $8::jsonb)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      appNum,
      applicant_id || null,
      req.user?.id || null,
      position_title,
      item_number || 'PENDING-ITEM',
      finalDivision,
      proposed_qs_eval_result || 'Qualified (Proposed QS)',
      JSON.stringify(documents || [])
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[Reclass Controller - createReclassApplication]', error);
    res.status(500).json({ error: error.message || 'Failed to create reclassification application' });
  }
}

/**
 * Re-evaluate application against CSC-approved QS
 */
export async function reevaluateCSC(req, res) {
  try {
    const { id } = req.params;
    const { csc_approved_qs_eval_result, evaluation_status, remarks } = req.body;

    if (!csc_approved_qs_eval_result) {
      return res.status(400).json({ error: 'CSC-approved QS evaluation result is required' });
    }

    const validStatus = evaluation_status || (
      csc_approved_qs_eval_result.toLowerCase().includes('qualified') ? 'reevaluated' : 'needs_applicant_update'
    );

    const updateQuery = `
      UPDATE reclassification_applications
      SET 
        csc_approved_qs_eval_result = $1,
        evaluation_status = $2,
        reevaluation_timestamp = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      csc_approved_qs_eval_result,
      validStatus,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reclassification record not found' });
    }

    res.json({
      message: 'Re-evaluation recorded successfully',
      application: result.rows[0],
      remarks: remarks || null
    });
  } catch (error) {
    console.error('[Reclass Controller - reevaluateCSC]', error);
    res.status(500).json({ error: error.message || 'Failed to re-evaluate application' });
  }
}

/**
 * Update applicant documents / credentials
 */
export async function updateCredentials(req, res) {
  try {
    const { id } = req.params;
    const { documents, notes } = req.body;

    // Fetch existing docs to merge
    const existing = await pool.query('SELECT documents FROM reclassification_applications WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reclassification record not found' });
    }

    let existingDocs = [];
    try {
      existingDocs = Array.isArray(existing.rows[0].documents)
        ? existing.rows[0].documents
        : JSON.parse(existing.rows[0].documents || '[]');
    } catch {
      existingDocs = [];
    }

    const newDocs = Array.isArray(documents) ? documents : (documents ? [documents] : []);
    const mergedDocs = [...existingDocs, ...newDocs];

    const updateQuery = `
      UPDATE reclassification_applications
      SET 
        documents = $1::jsonb,
        has_updated_credentials = TRUE,
        updated_credentials_submitted_at = NOW(),
        evaluation_status = CASE 
          WHEN evaluation_status = 'needs_applicant_update' THEN 'pending_reevaluation'
          ELSE evaluation_status
        END,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [JSON.stringify(mergedDocs), id]);

    res.json({
      message: 'Applicant credentials updated successfully',
      application: result.rows[0]
    });
  } catch (error) {
    console.error('[Reclass Controller - updateCredentials]', error);
    res.status(500).json({ error: error.message || 'Failed to update credentials' });
  }
}

/**
 * Export report for DBM submission (Excel format)
 */
export async function exportDbmReport(req, res) {
  try {
    // Select all re-evaluated or ready applications
    const query = `
      SELECT 
        ra.*,
        COALESCE(TRIM(CONCAT(a.first_name, ' ', a.surname)), CONCAT('Applicant ', ra.application_number)) AS applicant_name,
        COALESCE(a.email_address, 'applicant@deped.gov.ph') AS applicant_email
      FROM reclassification_applications ra
      LEFT JOIN applicants a ON ra.applicant_id = a.id
      ORDER BY ra.id ASC;
    `;

    const result = await pool.query(query);
    const rows = result.rows;

    // Stamp DBM export timestamp for the exported records
    await pool.query(`
      UPDATE reclassification_applications
      SET dbm_export_timestamp = NOW(), updated_at = NOW()
      WHERE evaluation_status = 'reevaluated' AND dbm_export_timestamp IS NULL;
    `);

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DepEd AGAP Portal - Reclassification Module';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('DBM Submission List', {
      views: [{ showGridLines: true }]
    });

    // Title rows
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DEPARTMENT OF EDUCATION - RECLASSIFICATION SUBMISSION (DBM)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF08315F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:I2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Generated on: ${new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} | Total Applications: ${rows.length}`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Header row
    const headers = [
      'No.',
      'Application Number',
      'Applicant Name',
      'Position Title',
      'Item Number',
      'Station / Division',
      'Proposed QS Result',
      'CSC-Approved QS Result',
      'Evaluation Status'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Navy
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Populate data
    rows.forEach((row, idx) => {
      const dataRow = sheet.addRow([
        idx + 1,
        row.application_number,
        row.applicant_name,
        row.position_title,
        row.item_number || '—',
        row.station_division || '—',
        row.proposed_qs_eval_result || '—',
        row.csc_approved_qs_eval_result || 'Pending CSC Review',
        row.evaluation_status || 'pending_reevaluation'
      ]);

      dataRow.height = 20;
      dataRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (colNum === 1 || colNum === 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Column widths
    sheet.columns = [
      { width: 8 },
      { width: 22 },
      { width: 30 },
      { width: 32 },
      { width: 26 },
      { width: 22 },
      { width: 25 },
      { width: 25 },
      { width: 22 }
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="DepEd_Reclassification_DBM_Export_${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[Reclass Controller - exportDbmReport]', error);
    res.status(500).json({ error: error.message || 'Failed to export DBM report' });
  }
}

const VALID_STAGES = ['For Review', 'Endorsed', 'Approved', 'Denied'];
const VALID_POSITIONS = ['School Counselor I', 'School Counselor II', 'School Counselor III', 'School Counselor IV'];

/**
 * Fetch all incumbent guidance counselors with evaluation credentials
 */
export async function getIncumbents(req, res) {
  try {
    const { stage, position, division, search } = req.query;

    let query = `
      SELECT 
        g.id,
        g.employee_id,
        g.full_name,
        g.current_position,
        g.station_division,
        g.stage_of_reclassification,
        g.reclass_position,
        g.created_at,
        g.updated_at,
        a.education,
        a.years_experience,
        a.hours_of_training,
        a.eligibility,
        a.documents,
        a.updated_at AS assessment_updated_at
      FROM incumbent_guidance_counselors g
      LEFT JOIN incumbent_assessment_data a ON g.employee_id = a.employee_id
      WHERE 1=1
    `;

    const params = [];

    if (stage) {
      params.push(stage);
      query += ` AND g.stage_of_reclassification = $${params.length}`;
    }

    if (position) {
      params.push(position);
      query += ` AND g.reclass_position = $${params.length}`;
    }

    if (division) {
      params.push(`%${division}%`);
      query += ` AND g.station_division ILIKE $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        g.employee_id ILIKE $${params.length} OR
        g.full_name ILIKE $${params.length} OR
        g.current_position ILIKE $${params.length} OR
        g.station_division ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY g.id ASC`;

    const result = await pool.query(query, params);

    const formatted = result.rows.map(row => {
      let parsedDocs = [];
      if (row.documents) {
        try {
          parsedDocs = typeof row.documents === 'string' ? JSON.parse(row.documents) : row.documents;
        } catch (e) {
          parsedDocs = [];
        }
      }

      return {
        id: row.id,
        employee_id: row.employee_id,
        full_name: row.full_name,
        current_position: row.current_position,
        station_division: row.station_division,
        stage_of_reclassification: row.stage_of_reclassification,
        reclass_position: row.reclass_position,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assessment: {
          education: row.education,
          years_experience: row.years_experience !== null ? parseFloat(row.years_experience) : null,
          hours_of_training: row.hours_of_training !== null ? parseFloat(row.hours_of_training) : null,
          eligibility: row.eligibility,
          documents: parsedDocs,
          updated_at: row.assessment_updated_at
        }
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('[Reclass Controller - getIncumbents]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch incumbent guidance counselors' });
  }
}

/**
 * Update incumbent counselor's stage of reclassification
 */
export async function updateIncumbentStage(req, res) {
  try {
    const { id } = req.params;
    const { stage_of_reclassification } = req.body;

    if (!stage_of_reclassification || !VALID_STAGES.includes(stage_of_reclassification)) {
      return res.status(400).json({
        error: `Invalid stage_of_reclassification. Must be one of: ${VALID_STAGES.join(', ')}`
      });
    }

    const updateQuery = `
      UPDATE incumbent_guidance_counselors
      SET stage_of_reclassification = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [stage_of_reclassification, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Reclass Controller - updateIncumbentStage]', error);
    res.status(500).json({ error: error.message || 'Failed to update reclassification stage' });
  }
}

/**
 * Update incumbent counselor's assigned reclassification position
 */
export async function updateIncumbentPosition(req, res) {
  try {
    const { id } = req.params;
    const { reclass_position } = req.body;

    const targetPosition = (reclass_position === '' || reclass_position === undefined) ? null : reclass_position;

    if (targetPosition !== null && !VALID_POSITIONS.includes(targetPosition)) {
      return res.status(400).json({
        error: `Invalid reclass_position. Must be one of: ${VALID_POSITIONS.join(', ')} or null/empty`
      });
    }

    const updateQuery = `
      UPDATE incumbent_guidance_counselors
      SET reclass_position = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [targetPosition, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Reclass Controller - updateIncumbentPosition]', error);
    res.status(500).json({ error: error.message || 'Failed to update reclassification position' });
  }
}

/**
 * Retrieve document attachments for an incumbent counselor
 */
export async function getIncumbentDocuments(req, res) {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        g.id,
        g.employee_id,
        g.full_name,
        a.documents
      FROM incumbent_guidance_counselors g
      LEFT JOIN incumbent_assessment_data a ON g.employee_id = a.employee_id
      WHERE g.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    let docs = [];
    if (result.rows[0].documents) {
      try {
        docs = typeof result.rows[0].documents === 'string'
          ? JSON.parse(result.rows[0].documents)
          : result.rows[0].documents;
      } catch (e) {
        docs = [];
      }
    }

    res.json({
      incumbent_id: result.rows[0].id,
      employee_id: result.rows[0].employee_id,
      full_name: result.rows[0].full_name,
      documents: docs
    });
  } catch (error) {
    console.error('[Reclass Controller - getIncumbentDocuments]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch incumbent documents' });
  }
}

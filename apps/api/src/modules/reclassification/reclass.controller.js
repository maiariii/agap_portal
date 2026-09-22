import { pool } from '../../config/db.js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if the authenticated user has a Regional Office role/position
 */
function isUserRegionalOffice(req) {
  const userRole = req.user?.role;
  return (
    userRole === 'regional_office' ||
    userRole === 'regional_director' ||
    (String(userRole || '').toLowerCase().includes('regional') && userRole !== 'admin') ||
    String(req.user?.position || '').toLowerCase().trim() === 'regional office'
  );
}

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
    if (isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Step 2 (Assessment Workbench) is restricted to Division HRMO.' });
    }

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

const VALID_MANUAL_STAGES = ['For Review', 'Endorsed', 'Denied', 'Unfilled / Vacant', 'Abolition'];
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
        g.plantilla_item_number,
        g.full_name,
        g.current_position,
        g.salary_grade,
        g.region,
        g.division,
        g.uacs_oper_dsc,
        g.station_division,
        g.org_cd,
        g.remarks,
        g.stage_of_reclassification,
        g.reclass_position,
        g.dbm_status,
        g.created_at,
        g.updated_at
      FROM incumbent_guidance_counselors g
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
      query += ` AND (g.station_division ILIKE $${params.length} OR g.division ILIKE $${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        g.employee_id ILIKE $${params.length} OR
        g.plantilla_item_number ILIKE $${params.length} OR
        g.full_name ILIKE $${params.length} OR
        g.current_position ILIKE $${params.length} OR
        g.station_division ILIKE $${params.length} OR
        g.division ILIKE $${params.length} OR
        g.region ILIKE $${params.length} OR
        g.uacs_oper_dsc ILIKE $${params.length} OR
        g.remarks ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY g.id ASC`;

    const result = await pool.query(query, params);

    const formatted = result.rows.map(row => {
      return {
        id: row.id,
        employee_id: row.employee_id,
        plantilla_item_number: row.plantilla_item_number,
        full_name: row.full_name,
        current_position: row.current_position,
        salary_grade: row.salary_grade,
        region: row.region,
        division: row.division,
        uacs_oper_dsc: row.uacs_oper_dsc,
        station_division: row.station_division,
        org_cd: row.org_cd,
        remarks: row.remarks,
        stage_of_reclassification: row.stage_of_reclassification,
        reclass_position: row.reclass_position,
        dbm_status: row.dbm_status || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assessment: {
          education: 'Bachelor of Science in Psychology / Guidance Counseling',
          years_experience: 5.0,
          hours_of_training: 40.0,
          eligibility: 'RA 1080 (Registered Guidance Counselor)',
          documents: []
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
    if (isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Step 2 (Assessment Workbench) is restricted to Division HRMO.' });
    }

    const { id } = req.params;
    const { stage_of_reclassification } = req.body;

    if (stage_of_reclassification === 'Approved') {
      const current = await pool.query('SELECT dbm_status FROM incumbent_guidance_counselors WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({ error: 'Incumbent counselor not found' });
      }
      if (current.rows[0].dbm_status !== 'With DBM NOSCA') {
        return res.status(400).json({
          error: 'The "Approved" stage is automatically set when DBM Status is "With DBM NOSCA" and cannot be manually selected.'
        });
      }
    } else if (!stage_of_reclassification || !VALID_MANUAL_STAGES.includes(stage_of_reclassification)) {
      return res.status(400).json({
        error: `Invalid stage_of_reclassification. Must be one of: ${VALID_MANUAL_STAGES.join(', ')}`
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
    if (isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Step 2 (Assessment Workbench) is restricted to Division HRMO.' });
    }

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
 * Update incumbent counselor's DBM status ('With DBM Request' or 'With DBM NOSCA')
 * and assign / link corresponding plantilla item in reclassification_nosca_items
 */
export async function updateIncumbentDbmStatus(req, res) {
  let client;
  try {
    if (!isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Only Regional Office personnel may update DBM status.' });
    }

    const { id } = req.params;
    const { dbm_status, plantilla_item_number } = req.body;

    const validDbmStatuses = ['With DBM Request', 'With DBM NOSCA', 'None', null, ''];
    if (dbm_status && !validDbmStatuses.includes(dbm_status)) {
      return res.status(400).json({
        error: `Invalid dbm_status. Must be 'With DBM Request', 'With DBM NOSCA', or empty.`
      });
    }

    const valueToSet = (dbm_status === 'None' || dbm_status === '' || dbm_status === undefined) ? null : dbm_status;
    const isNosca = valueToSet === 'With DBM NOSCA';
    const cleanItemNo = (typeof plantilla_item_number === 'string' && plantilla_item_number.trim()) ? plantilla_item_number.trim() : null;

    client = await pool.connect();
    await client.query('BEGIN');

    // Retrieve incumbent counselor details
    const incRes = await client.query('SELECT * FROM incumbent_guidance_counselors WHERE id = $1', [id]);
    if (incRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }
    const incumbent = incRes.rows[0];

    // Release any previous NOSCA item assigned to this incumbent if changing item or unsetting NOSCA
    if (!isNosca || (cleanItemNo && incumbent.plantilla_item_number !== cleanItemNo)) {
      await client.query(
        `UPDATE reclassification_nosca_items
         SET assignment_status = 'AVAILABLE',
             assigned_to_incumbent_id = NULL,
             assigned_to_employee_id = NULL,
             assigned_at = NULL,
             updated_at = NOW()
         WHERE assigned_to_incumbent_id = $1`,
        [id]
      );
    }

    let updateQuery;
    let queryParams;

    if (isNosca && cleanItemNo) {
      updateQuery = `
        UPDATE incumbent_guidance_counselors
        SET dbm_status = $1,
            stage_of_reclassification = 'Approved',
            plantilla_item_number = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *;
      `;
      queryParams = [valueToSet, cleanItemNo, id];
    } else if (isNosca) {
      updateQuery = `
        UPDATE incumbent_guidance_counselors
        SET dbm_status = $1,
            stage_of_reclassification = 'Approved',
            updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      queryParams = [valueToSet, id];
    } else {
      updateQuery = `
        UPDATE incumbent_guidance_counselors
        SET dbm_status = $1,
            stage_of_reclassification = CASE
              WHEN stage_of_reclassification = 'Approved' THEN 'Endorsed'
              ELSE stage_of_reclassification
            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      queryParams = [valueToSet, id];
    }

    const result = await client.query(updateQuery, queryParams);
    const updatedIncumbent = result.rows[0];

    // If With DBM NOSCA and cleanItemNo, link and mark item in reclassification_nosca_items as ASSIGNED
    if (isNosca && cleanItemNo) {
      const updateItemRes = await client.query(
        `UPDATE reclassification_nosca_items
         SET assignment_status = 'ASSIGNED',
             assigned_to_incumbent_id = $1,
             assigned_to_employee_id = $2,
             assigned_at = NOW(),
             updated_at = NOW()
         WHERE plantilla_item_number = $3`,
        [id, incumbent.employee_id, cleanItemNo]
      );

      // If the item wasn't in reclassification_nosca_items yet (e.g. manually entered), insert it as ASSIGNED
      if (updateItemRes.rowCount === 0) {
        await client.query(
          `INSERT INTO reclassification_nosca_items (
            serial_no,
            plantilla_item_number,
            category,
            position_title,
            division,
            school_name,
            assignment_status,
            assigned_to_incumbent_id,
            assigned_to_employee_id,
            assigned_at,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
          [
            'MANUAL-ASSIGNMENT',
            cleanItemNo,
            'ELEMENTARY',
            incumbent.reclass_position || 'School Counselor Associate I',
            incumbent.division || incumbent.station_division || 'SDO Station',
            incumbent.station_division || incumbent.division || 'SDO Station',
            'ASSIGNED',
            id,
            incumbent.employee_id
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json(updatedIncumbent);
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[Reclass Controller - updateIncumbentDbmStatus]', error);
    res.status(500).json({ error: error.message || 'Failed to update DBM status' });
  } finally {
    if (client) client.release();
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
        g.full_name
      FROM incumbent_guidance_counselors g
      WHERE g.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    res.json({
      incumbent_id: result.rows[0].id,
      employee_id: result.rows[0].employee_id,
      full_name: result.rows[0].full_name,
      documents: []
    });
  } catch (error) {
    console.error('[Reclass Controller - getIncumbentDocuments]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch incumbent documents' });
  }
}

/**
 * Parse CSV text respecting quoted commas and escaped quotes
 */
function parseCSVRows(csvText) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let inQuotes = false;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Ingest Reclassification Inventory CSV into incumbent_guidance_counselors
 */
export async function uploadReclassCsv(req, res) {
  let client;
  try {
    if (isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Step 1 (Inventory CSV Ingestion) is restricted to Division HRMO.' });
    }

    const { csvContent, fileName, useDefaultFile, replaceExisting } = req.body;
    let rawCsv = '';

    if (useDefaultFile) {
      const candidates = [
        path.resolve(__dirname, '../../../../../Inventory of Application for GC Reclass(Sheet2)2.csv'),
        path.resolve(process.cwd(), 'Inventory of Application for GC Reclass(Sheet2)2.csv'),
        path.resolve(__dirname, '../../../../Inventory of Application for GC Reclass(Sheet2)2.csv')
      ];
      const foundPath = candidates.find(p => fs.existsSync(p));
      if (!foundPath) {
        return res.status(404).json({ error: 'Official master inventory CSV file not found on server.' });
      }
      rawCsv = fs.readFileSync(foundPath, 'utf8');
    } else {
      if (!csvContent || typeof csvContent !== 'string' || !csvContent.trim()) {
        return res.status(400).json({ error: 'No CSV content provided for ingestion.' });
      }
      rawCsv = csvContent;
    }

    const parsedRows = parseCSVRows(rawCsv);
    if (parsedRows.length <= 1) {
      return res.status(400).json({ error: 'The provided CSV is empty or has no data rows.' });
    }

    // Header normalization
    const rawHeader = parsedRows[0];
    const normalizedHeaders = rawHeader.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Find column indexes
    let regionIdx = normalizedHeaders.findIndex(h => h.includes('region'));
    let divisionIdx = normalizedHeaders.findIndex(h => h.includes('division'));
    let stationIdx = normalizedHeaders.findIndex(h => h.includes('uacs') || h.includes('station') || h.includes('oper') || h.includes('school'));
    let orgCdIdx = normalizedHeaders.findIndex(h => h.includes('orgcd') || h.includes('org'));
    let itemNoIdx = normalizedHeaders.findIndex(h => h.includes('plantilla') || h.includes('itemno') || h.includes('itemnum'));
    let posIdx = normalizedHeaders.findIndex(h => h.includes('positiontitle') || (h.includes('position') && !h.includes('reclass')));
    let sgIdx = normalizedHeaders.findIndex(h => h.includes('salarygrade') || h === 'sg');
    let nameIdx = normalizedHeaders.findIndex(h => h.includes('incumbent') || h.includes('fullname') || h === 'name');
    let reclassPosIdx = normalizedHeaders.findIndex(h => h.includes('reclass') || h.includes('targetpos'));
    let remarksIdx = normalizedHeaders.findIndex(h => h.includes('remark') || h.includes('notes'));

    // Fallback to default index positions if headers didn't match
    if (itemNoIdx === -1) itemNoIdx = 4;
    if (regionIdx === -1) regionIdx = 0;
    if (divisionIdx === -1) divisionIdx = 1;
    if (stationIdx === -1) stationIdx = 2;
    if (orgCdIdx === -1) orgCdIdx = 3;
    if (posIdx === -1) posIdx = 5;
    if (sgIdx === -1) sgIdx = 6;
    if (nameIdx === -1) nameIdx = 7;
    if (reclassPosIdx === -1) reclassPosIdx = 8;
    if (remarksIdx === -1) remarksIdx = 9;

    const dataRows = parsedRows.slice(1);
    client = await pool.connect();

    // If replaceExisting is requested, delete old records
    if (replaceExisting) {
      await client.query('TRUNCATE TABLE incumbent_guidance_counselors CASCADE');
    }

    let insertedOrUpdated = 0;
    let vacantCount = 0;
    let abolitionCount = 0;
    let forReviewCount = 0;

    const chunkSize = 200;
    for (let i = 0; i < dataRows.length; i += chunkSize) {
      const chunk = dataRows.slice(i, i + chunkSize);
      const values = [];
      const placeholders = [];
      let pIdx = 1;

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const region = row[regionIdx] || null;
        const division = row[divisionIdx] || null;
        const uacs_oper_dsc = row[stationIdx] || null;
        const org_cd = row[orgCdIdx] || null;
        const plantilla_item_number = (row[itemNoIdx] || '').trim();
        const current_position = (row[posIdx] || 'Unassigned').trim();
        const salary_grade = row[sgIdx] || null;
        const rawName = (row[nameIdx] || '').trim();
        const rawReclass = (row[reclassPosIdx] || '').trim();
        const remarks = row[remarksIdx] || null;

        const full_name = (!rawName || rawName.toUpperCase() === '#N/A') ? '#N/A' : rawName;
        const reclass_position = (rawReclass && rawReclass.toUpperCase() !== '#N/A') ? rawReclass : null;

        // Determine employee_id and station_division
        const employee_id = plantilla_item_number || `ITEM-${i + j + 1}-${Date.now()}`;
        const station_division = division || uacs_oper_dsc || 'Unknown Station';

        // Stage determination
        let stage_of_reclassification = 'For Review';
        const upperName = full_name.toUpperCase();
        const upperRemarks = (remarks || '').toUpperCase();

        if (upperName === '#N/A' || upperName === 'VACANT' || upperName === 'UNFILLED') {
          stage_of_reclassification = 'Unfilled / Vacant';
          vacantCount++;
        } else if (upperRemarks.includes('ABOLITION')) {
          stage_of_reclassification = 'Abolition';
          abolitionCount++;
        } else {
          forReviewCount++;
        }

        placeholders.push(
          `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
        );

        values.push(
          employee_id,
          plantilla_item_number,
          full_name,
          current_position,
          salary_grade,
          region,
          division,
          uacs_oper_dsc,
          station_division,
          org_cd,
          remarks,
          stage_of_reclassification,
          reclass_position
        );
      }

      if (placeholders.length > 0) {
        const query = `
          INSERT INTO incumbent_guidance_counselors (
            employee_id,
            plantilla_item_number,
            full_name,
            current_position,
            salary_grade,
            region,
            division,
            uacs_oper_dsc,
            station_division,
            org_cd,
            remarks,
            stage_of_reclassification,
            reclass_position
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (employee_id) DO UPDATE SET
            plantilla_item_number = EXCLUDED.plantilla_item_number,
            full_name = EXCLUDED.full_name,
            current_position = EXCLUDED.current_position,
            salary_grade = EXCLUDED.salary_grade,
            region = EXCLUDED.region,
            division = EXCLUDED.division,
            uacs_oper_dsc = EXCLUDED.uacs_oper_dsc,
            station_division = EXCLUDED.station_division,
            org_cd = EXCLUDED.org_cd,
            remarks = EXCLUDED.remarks,
            stage_of_reclassification = EXCLUDED.stage_of_reclassification,
            reclass_position = COALESCE(EXCLUDED.reclass_position, incumbent_guidance_counselors.reclass_position),
            updated_at = NOW();
        `;
        await client.query(query, values);
        insertedOrUpdated += chunk.length;
      }
    }

    const countRes = await client.query('SELECT COUNT(*) as total FROM incumbent_guidance_counselors');

    res.json({
      success: true,
      message: `Successfully ingested ${insertedOrUpdated} records from ${fileName || 'official inventory'}.`,
      totalProcessed: dataRows.length,
      insertedOrUpdated,
      totalInDatabase: parseInt(countRes.rows[0]?.total || 0, 10),
      metrics: {
        vacant: vacantCount,
        abolition: abolitionCount,
        forReview: forReviewCount
      }
    });
  } catch (error) {
    console.error('[Reclass Controller - uploadReclassCsv]', error);
    res.status(500).json({ error: error.message || 'Failed to ingest reclassification CSV' });
  } finally {
    if (client) client.release();
  }
}

/**
 * Stream/download the standard Guidance Counselor Reclassification CSV template
 */
export async function downloadReclassTemplate(req, res) {
  try {
    const csvContent = [
      'REGION,DIVISION,UACS_OPER_DSC,ORG_CD,PLANTILLA ITEM NUMBER,POSITION TITLE,SALARY GRADE,INCUMBENT,RECLASS POSITION,REMARKS',
      'National Capital Region (NCR),Division of Quezon City,Batasan Hills National High School,1015.01,OSEC-DECSB-GCOOR3-0001-2024,Guidance Coordinator III,16,"SANTOS, MARIA CLARA",School Counselor III,Active Incumbent',
      'Region IV-A - CALABARZON,Division of Cavite,Dasmariñas National High School,1015.02,OSEC-DECSB-GCOOR2-0002-2024,Guidance Coordinator II,15,"DELA CRUZ, JUAN",School Counselor II,Active Incumbent',
      'Region III - Central Luzon,Division of Pampanga,San Fernando High School,1015.03,OSEC-DECSB-GCOOR1-0003-2024,Guidance Coordinator I,14,#N/A,#N/A,VACANT ITEM',
      'Region VII - Central Visayas,Division of Cebu City,Abellana National School,1015.04,OSEC-DECSB-GCOOR3-0004-2024,Guidance Coordinator III,16,"REYES, ANA LORRAINE",School Counselor III,SUBMITTED FOR ABOLITION'
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="DepEd_GC_Reclassification_Template.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('[Reclass Controller - downloadReclassTemplate]', error);
    res.status(500).json({ error: 'Failed to generate template CSV' });
  }
}

/**
 * Scan NOSCA PDF using root scanner.py (Regional Office privilege)
 */
export async function scanReclassNosca(req, res) {
  let tempFilePath = null;
  try {
    const userRole = req.user?.role;
    const isRegionalOffice = 
      userRole === 'regional_office' || 
      userRole === 'regional_director' || 
      userRole === 'admin' ||
      String(req.user?.position || '').toLowerCase().trim() === 'regional office';

    if (!isRegionalOffice) {
      return res.status(403).json({ error: 'Access denied: Only Regional Office personnel may scan NOSCA documents.' });
    }

    const { fileData, fileName } = req.body;
    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'No PDF file data provided for NOSCA scanning.' });
    }

    const base64Clean = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const pdfBuffer = Buffer.from(base64Clean, 'base64');
    if (pdfBuffer.length === 0) {
      return res.status(400).json({ error: 'The uploaded file appears to be empty.' });
    }

    const tempFileName = `nosca_${Date.now()}_${randomUUID().slice(0, 8)}.pdf`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // Locate scanner.py
    const candidates = [
      path.resolve(process.cwd(), 'scanner.py'),
      path.resolve(__dirname, '../../../../../scanner.py'),
      path.resolve(__dirname, '../../../../scanner.py'),
      path.resolve(__dirname, '../../../scanner.py'),
      path.resolve('c:/Users/SC/OneDrive - Department of Education/Desktop/agap_portal/scanner.py')
    ];
    let scannerPath = candidates.find(p => fs.existsSync(p));
    if (!scannerPath) {
      scannerPath = candidates[0];
    }

    const pyProcess = spawn('python', [scannerPath, tempFilePath], {
      windowsHide: true,
      timeout: 60000
    });

    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString('utf8');
    });

    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString('utf8');
    });

    pyProcess.on('error', (err) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (_) {}
      }
      return res.status(500).json({ error: `Failed to execute scanner: ${err.message}` });
    });

    pyProcess.on('close', (code) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (_) {}
      }

      const trimmed = stdout.trim();
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        return res.status(500).json({ 
          error: stderr.trim() || `Scanner failed to parse PDF (exit code ${code}).` 
        });
      }

      try {
        const jsonStr = trimmed.substring(firstBrace, lastBrace + 1);
        const result = JSON.parse(jsonStr);

        if (result.error) {
          return res.status(400).json({ error: result.error });
        }

        return res.json({
          success: true,
          message: 'NOSCA scanned and parsed successfully',
          fileName: fileName || 'NOSCA.pdf',
          data: result
        });
      } catch (parseErr) {
        return res.status(500).json({ error: `Failed to parse scanner output: ${parseErr.message}` });
      }
    });
  } catch (error) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    console.error('[Reclass Controller - scanReclassNosca]', error);
    res.status(500).json({ error: error.message || 'Failed to scan NOSCA document' });
  }
}

/**
 * Retrieve NOSCA plantilla items from reclassification_nosca_items table
 */
export async function getNoscaItems(req, res) {
  try {
    const { status, division, serialNo } = req.query;

    let query = `
      SELECT 
        id,
        serial_no,
        plantilla_item_number,
        category,
        position_title,
        division,
        school_id,
        school_name,
        assignment_status,
        assigned_to_incumbent_id,
        assigned_to_employee_id,
        assigned_at,
        created_at,
        updated_at
      FROM reclassification_nosca_items
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      query += ` AND assignment_status = $${params.length}`;
    }

    if (division && division !== 'ALL') {
      params.push(`%${division}%`);
      query += ` AND division ILIKE $${params.length}`;
    }

    if (serialNo) {
      params.push(serialNo);
      query += ` AND serial_no = $${params.length}`;
    }

    query += ` ORDER BY id ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('[Reclass Controller - getNoscaItems]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch NOSCA items' });
  }
}

/**
 * Autocomplete search schools from agap_schools table
 */
export async function searchSchools(req, res) {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      const defaultRows = await pool.query(
        'SELECT school_id, school_name, division, region FROM agap_schools WHERE school_id IS NOT NULL ORDER BY school_name ASC LIMIT 20'
      );
      return res.json(defaultRows.rows);
    }

    const cleanQ = q.trim();
    const isNumeric = /^\d+$/.test(cleanQ);

    let query;
    let params;

    if (isNumeric) {
      query = `
        SELECT school_id, school_name, division, region
        FROM agap_schools
        WHERE CAST(school_id AS TEXT) LIKE $1
        ORDER BY school_id ASC
        LIMIT 25
      `;
      params = [`${cleanQ}%`];
    } else {
      query = `
        SELECT school_id, school_name, division, region
        FROM agap_schools
        WHERE school_name ILIKE $1 OR CAST(school_id AS TEXT) LIKE $1
        ORDER BY 
          CASE WHEN school_name ILIKE $2 THEN 1 ELSE 2 END,
          school_name ASC
        LIMIT 25
      `;
      params = [`%${cleanQ}%`, `${cleanQ}%`];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('[Reclass Controller - searchSchools]', error);
    res.status(500).json({ error: error.message || 'Failed to search schools' });
  }
}

/**
 * Commit selected NOSCA plantilla items into reclassification_nosca_items table
 */
export async function importNoscaItems(req, res) {
  let client;
  try {
    const userRole = req.user?.role;
    const isRegionalOffice = 
      userRole === 'regional_office' || 
      userRole === 'regional_director' || 
      userRole === 'admin' ||
      String(req.user?.position || '').toLowerCase().trim() === 'regional office';

    if (!isRegionalOffice) {
      return res.status(403).json({ error: 'Access denied: Only Regional Office personnel may import NOSCA items.' });
    }

    const { serialNo, division, schoolId, schoolName, position, items, categoryBreakdown } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No plantilla items selected for import.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    // Helper to determine category for an item if breakdown is provided
    const getCategoryForItem = (itemNo) => {
      if (categoryBreakdown && typeof categoryBreakdown === 'object') {
        for (const [catKey, catItems] of Object.entries(categoryBreakdown)) {
          if (Array.isArray(catItems) && catItems.includes(itemNo)) {
            return catKey;
          }
        }
      }
      return 'ELEMENTARY';
    };

    for (const itemNo of items) {
      const trimmedItem = String(itemNo).trim();
      if (!trimmedItem) continue;

      const itemCategory = getCategoryForItem(trimmedItem);
      const divName = division 
        ? (division.toLowerCase().startsWith('division') ? division : `Division of ${division}`) 
        : 'Regional Office';
      const schName = schoolName || 'Regional Allocation Station';

      // Check if item already exists in reclassification_nosca_items
      const existing = await client.query(
        'SELECT id, assignment_status, assigned_to_incumbent_id FROM reclassification_nosca_items WHERE plantilla_item_number = $1 LIMIT 1',
        [trimmedItem]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        await client.query(
          `UPDATE reclassification_nosca_items
           SET serial_no = COALESCE($1, serial_no),
               division = COALESCE($2, division),
               school_id = COALESCE($3, school_id),
               school_name = COALESCE($4, school_name),
               position_title = COALESCE($5, position_title),
               category = COALESCE($6, category),
               updated_at = NOW()
           WHERE id = $7`,
          [serialNo || null, divName, schoolId ? String(schoolId) : null, schName, position || 'School Counselor Associate I', itemCategory, row.id]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO reclassification_nosca_items (
            serial_no,
            plantilla_item_number,
            category,
            position_title,
            division,
            school_id,
            school_name,
            assignment_status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'AVAILABLE', NOW(), NOW())`,
          [
            serialNo || null,
            trimmedItem,
            itemCategory,
            position || 'School Counselor Associate I',
            divName,
            schoolId ? String(schoolId) : null,
            schName
          ]
        );
        inserted++;
      }
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Successfully registered ${items.length} NOSCA plantilla items (${inserted} newly allocated, ${updated} existing updated).`,
      inserted,
      updated,
      total: items.length
    });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[Reclass Controller - importNoscaItems]', error);
    res.status(500).json({ error: error.message || 'Failed to import NOSCA plantilla items.' });
  } finally {
    if (client) client.release();
  }
}


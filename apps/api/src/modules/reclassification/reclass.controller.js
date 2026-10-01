import { pool } from '../../config/db.js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';
import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

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
        ra.reclass_gc_id,
        ra.item_no,
        ra.current_position,
        ra.region,
        ra.division,
        ra.school_id,
        ra.school_name,
        ra.reclass_position,
        ra.new_item_no,
        ra.created_at,
        ra.updated_at,
        -- Aliases for backwards compatibility:
        ra.item_no AS current_item_number,
        ra.current_position AS position_title,
        ra.reclass_position AS actual_position,
        ra.new_item_no AS new_item_number,
        ra.division AS station_division,
        rg.first_name,
        rg.last_name,
        rg.email,
        rg.qs_status,
        rg.stage_of_reclassification,
        COALESCE(
          TRIM(CONCAT(rg.first_name, ' ', rg.last_name)),
          CONCAT('Counselor #', ra.reclass_gc_id)
        ) AS applicant_name,
        COALESCE(rg.email, 'applicant@deped.gov.ph') AS applicant_email
      FROM reclass_applications ra
      LEFT JOIN reclass_gc rg ON ra.reclass_gc_id = rg.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      query += ` AND (rg.qs_status = $${params.length} OR rg.stage_of_reclassification = $${params.length})`;
    }

    if (division) {
      params.push(`%${division}%`);
      query += ` AND ra.division ILIKE $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        ra.item_no ILIKE $${params.length} OR
        ra.current_position ILIKE $${params.length} OR
        ra.reclass_position ILIKE $${params.length} OR
        ra.division ILIKE $${params.length} OR
        ra.region ILIKE $${params.length} OR
        ra.school_name ILIKE $${params.length} OR
        ra.school_id ILIKE $${params.length} OR
        rg.first_name ILIKE $${params.length} OR
        rg.last_name ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY ra.id DESC`;

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
      reclass_gc_id,
      item_no,
      current_item_number,
      current_position,
      position_title,
      region,
      division,
      station_division,
      school_id,
      school_name,
      reclass_position,
      actual_position,
      new_item_no,
      new_item_number
    } = req.body;

    const finalItemNo = item_no || current_item_number || 'PENDING-ITEM';
    const finalCurrentPos = current_position || position_title || 'Guidance Counselor';
    const finalRegion = region || req.user?.region || 'National Capital Region (NCR)';
    const finalDivision = division || station_division || req.user?.division || 'SDO Main';
    const finalReclassPos = reclass_position || actual_position || null;
    const finalNewItemNo = new_item_no || new_item_number || null;

    const insertQuery = `
      INSERT INTO reclass_applications (
        reclass_gc_id,
        item_no,
        current_position,
        region,
        division,
        school_id,
        school_name,
        reclass_position,
        new_item_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      reclass_gc_id || null,
      finalItemNo,
      finalCurrentPos,
      finalRegion,
      finalDivision,
      school_id || null,
      school_name || null,
      finalReclassPos,
      finalNewItemNo
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

    const nextStage = csc_approved_qs_eval_result.toLowerCase().includes('qualified') 
      ? 'Endorsed to RO' 
      : 'Needs Applicant Update';

    const updateQuery = `
      UPDATE reclass_gc
      SET 
        qs_status = $1,
        stage_of_reclassification = $2,
        updated_at = NOW()
      WHERE id = $3 OR CAST(id AS TEXT) = $3
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [csc_approved_qs_eval_result, nextStage, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reclassification record not found' });
    }

    // Touch application record if exists
    await pool.query(`
      UPDATE reclass_applications
      SET updated_at = NOW()
      WHERE reclass_gc_id = $1 OR id = $1
    `, [id]);

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

    const updateQuery = `
      UPDATE reclass_gc
      SET 
        updated_at = NOW()
      WHERE id = $1 OR CAST(id AS TEXT) = $1
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reclassification record not found' });
    }

    await pool.query(`
      UPDATE reclass_applications
      SET updated_at = NOW()
      WHERE reclass_gc_id = $1 OR id = $1
    `, [id]);

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
    // Select all applications joined with reclass_gc
    const query = `
      SELECT 
        ra.id,
        ra.reclass_gc_id,
        ra.item_no,
        ra.current_position,
        ra.region,
        ra.division,
        ra.school_id,
        ra.school_name,
        ra.reclass_position,
        ra.new_item_no,
        ra.created_at,
        ra.updated_at,
        COALESCE(TRIM(CONCAT(rg.first_name, ' ', rg.last_name)), CONCAT('GC #', ra.reclass_gc_id)) AS applicant_name,
        COALESCE(rg.email, 'applicant@deped.gov.ph') AS applicant_email
      FROM reclass_applications ra
      LEFT JOIN reclass_gc rg ON ra.reclass_gc_id = rg.id
      ORDER BY ra.id ASC;
    `;

    const result = await pool.query(query);
    const rows = result.rows;

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DepEd AGAP Portal - Reclassification Module';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('DBM Submission List', {
      views: [{ showGridLines: true }]
    });

    // Title rows
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DEPARTMENT OF EDUCATION - RECLASSIFICATION SUBMISSION (DBM)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF08315F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:L2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Generated on: ${new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} | Total Applications: ${rows.length}`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Header row
    const headers = [
      'No.',
      'Application ID',
      'GC ID',
      'Applicant Name',
      'Current Position',
      'Item No.',
      'Region',
      'Division',
      'School ID',
      'School Name',
      'Reclass Position',
      'New Item No.'
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
        `APP-${row.id}`,
        row.reclass_gc_id || '—',
        row.applicant_name,
        row.current_position || '—',
        row.item_no || '—',
        row.region || '—',
        row.division || '—',
        row.school_id || '—',
        row.school_name || '—',
        row.reclass_position || '—',
        row.new_item_no || '—'
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
        if (colNum <= 3) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Column widths
    sheet.columns = [
      { width: 8 },
      { width: 16 },
      { width: 12 },
      { width: 28 },
      { width: 26 },
      { width: 22 },
      { width: 22 },
      { width: 24 },
      { width: 14 },
      { width: 28 },
      { width: 26 },
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

const VALID_MANUAL_STAGES = [
  'For Review',
  'Endorsed to RO',
  'Endorsed to DBM RO',
  'Endorsed', // Backward compatibility
  'Approved',
  'Denied'
];
const VALID_POSITIONS = ['School Counselor I', 'School Counselor II', 'School Counselor III', 'School Counselor IV'];

/**
 * Synchronize stage of reclassification from reclass_gc to reclass_applications
 */
export async function syncIncumbentToApplication(clientOrPool, incumbent, newStage) {
  if (!incumbent || !incumbent.id) return;
  try {
    const itemNo = (incumbent.item_no || incumbent.plantilla_item_number || '').trim();

    // 1. Check for existing connected application
    const checkAppQuery = `
      SELECT id FROM reclass_applications
      WHERE reclass_gc_id = $1
         OR ($2 <> '' AND item_no ILIKE $2)
         OR ($2 <> '' AND new_item_no ILIKE $2)
      ORDER BY id ASC
    `;
    const checkRes = await clientOrPool.query(checkAppQuery, [incumbent.id, itemNo]);

    if (checkRes.rows.length > 0) {
      const appIds = checkRes.rows.map(r => r.id);
      await clientOrPool.query(`
        UPDATE reclass_applications
        SET reclass_gc_id = COALESCE(reclass_gc_id, $1),
            item_no = COALESCE(item_no, $2),
            current_position = COALESCE(current_position, $3),
            region = COALESCE(region, $4),
            division = COALESCE(division, $5),
            school_id = COALESCE(school_id, $6),
            school_name = COALESCE(school_name, $7),
            reclass_position = COALESCE(reclass_position, $8),
            new_item_no = COALESCE(new_item_no, $9),
            updated_at = NOW()
        WHERE id = ANY($10::int[])
      `, [
        incumbent.id,
        itemNo || null,
        incumbent.current_position || null,
        incumbent.region || null,
        incumbent.division || null,
        incumbent.school_id || null,
        incumbent.school_name || null,
        incumbent.reclass_position || null,
        incumbent.new_item_no || null,
        appIds
      ]);
    } else {
      // 2. Create a connected application row
      await clientOrPool.query(`
        INSERT INTO reclass_applications (
          reclass_gc_id,
          item_no,
          current_position,
          region,
          division,
          school_id,
          school_name,
          reclass_position,
          new_item_no
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `, [
        incumbent.id,
        itemNo || null,
        incumbent.current_position || null,
        incumbent.region || null,
        incumbent.division || null,
        incumbent.school_id || null,
        incumbent.school_name || null,
        incumbent.reclass_position || null,
        incumbent.new_item_no || null
      ]);
    }
  } catch (err) {
    console.error('[syncIncumbentToApplication Error]', err.message);
  }
}

/**
 * Synchronize stage of reclassification from reclass_applications to reclass_gc
 */
export async function syncApplicationToIncumbent(clientOrPool, appRecord, newStage) {
  if (!appRecord) return;
  try {
    const gcId = appRecord.reclass_gc_id;
    const itemNo = (appRecord.item_no || '').trim();
    const newItemNo = (appRecord.new_item_no || '').trim();

    const updateRes = await clientOrPool.query(`
      UPDATE reclass_gc
      SET updated_at = NOW()
      WHERE ($1::int IS NOT NULL AND id = $1)
         OR ($2 <> '' AND item_no ILIKE $2)
         OR ($3 <> '' AND item_no ILIKE $3)
      RETURNING id;
    `, [gcId || null, itemNo, newItemNo]);

    if (updateRes.rows.length > 0 && !gcId) {
      await clientOrPool.query(`
        UPDATE reclass_applications
        SET reclass_gc_id = $1
        WHERE id = $2
      `, [updateRes.rows[0].id, appRecord.id]);
    }
  } catch (err) {
    console.error('[syncApplicationToIncumbent Error]', err.message);
  }
}

/**
 * Fetch all incumbent guidance counselors with evaluation credentials
 */
export async function getIncumbents(req, res) {
  try {
    const { stage, position, division, search } = req.query;

    let query = `
      SELECT 
        g.id,
        g.item_no,
        g.item_no AS plantilla_item_number,
        g.first_name,
        g.last_name,
        TRIM(CONCAT(COALESCE(g.first_name, ''), ' ', COALESCE(g.last_name, ''))) AS full_name,
        g.email,
        g.current_position,
        g.region,
        g.division,
        g.division AS station_division,
        g.school_id,
        g.school_name,
        g.qs_status,
        g.qs_status AS qs_eval_result,
        g.stage_of_reclassification,
        COALESCE(ra.reclass_position, g.reclass_position) AS actual_position,
        COALESCE(ra.reclass_position, g.reclass_position) AS reclass_position,
        COALESCE(ra.reclass_position, g.reclass_position) AS target_position,
        COALESCE(ra.new_item_no, g.new_item_no) AS new_item_number,
        COALESCE(ra.new_item_no, g.new_item_no) AS new_item_no,
        g.is_test,
        g.reupload,
        g.created_at,
        g.updated_at
      FROM reclass_gc g
      LEFT JOIN LATERAL (
        SELECT reclass_position, new_item_no
        FROM reclass_applications ra
        WHERE ra.reclass_gc_id = g.id
           OR (
             ra.item_no IS NOT NULL 
             AND TRIM(LOWER(ra.item_no)) = TRIM(LOWER(g.item_no))
           )
           OR (
             ra.new_item_no IS NOT NULL
             AND TRIM(LOWER(ra.new_item_no)) = TRIM(LOWER(g.item_no))
           )
        ORDER BY ra.updated_at DESC NULLS LAST, ra.id DESC
        LIMIT 1
      ) ra ON true
      WHERE 1=1
    `;

    const params = [];

    if (stage) {
      params.push(stage);
      query += ` AND (g.stage_of_reclassification = $${params.length})`;
    }

    if (position) {
      if (position === 'UNASSIGNED') {
        query += ` AND (ra.reclass_position IS NULL AND g.reclass_position IS NULL)`;
      } else {
        params.push(position);
        query += ` AND (
          ra.reclass_position = $${params.length}
          OR g.reclass_position = $${params.length}
        )`;
      }
    }

    if (division) {
      params.push(`%${division}%`);
      query += ` AND (g.division ILIKE $${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        g.item_no ILIKE $${params.length} OR
        COALESCE(ra.new_item_no, g.new_item_no, '') ILIKE $${params.length} OR
        g.first_name ILIKE $${params.length} OR
        g.last_name ILIKE $${params.length} OR
        g.email ILIKE $${params.length} OR
        g.current_position ILIKE $${params.length} OR
        g.reclass_position ILIKE $${params.length} OR
        ra.reclass_position ILIKE $${params.length} OR
        g.division ILIKE $${params.length} OR
        g.school_id ILIKE $${params.length} OR
        g.school_name ILIKE $${params.length} OR
        g.region ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY g.id ASC`;

    const result = await pool.query(query, params);

    // Fetch records from reclass_documents to attach evaluated statuses and remarks
    let docsByItemNo = new Map();
    try {
      const allDocsRes = await pool.query(`
        SELECT 
          id,
          file_url,
          file_name,
          remarks,
          status,
          plantilla_item_number,
          document_title,
          uploaded_at,
          updated_at
        FROM reclass_documents
        ORDER BY id ASC;
      `);

      for (const d of allDocsRes.rows) {
        if (d.plantilla_item_number) {
          const k = d.plantilla_item_number.trim().toLowerCase();
          if (!docsByItemNo.has(k)) docsByItemNo.set(k, []);
          docsByItemNo.get(k).push(d);
        }
      }
    } catch (docErr) {
      console.warn('[Reclass Controller] Could not fetch reclass_documents:', docErr.message);
    }

    const formatted = result.rows.map(row => {
      const resolvedActualPos = row.actual_position || row.reclass_position || null;
      const rawDocs = docsByItemNo.get((row.item_no || '').trim().toLowerCase()) || [];
      const documentChecklist = rawDocs.map(d => ({
        id: d.document_title || d.file_name,
        key: d.document_title || d.file_name,
        label: d.document_title || d.file_name,
        shortTitle: d.document_title || d.file_name,
        status: d.status ? (d.status.toLowerCase() === 'approved' ? 'approved' : (d.status.toLowerCase() === 'for revision' || d.status.toLowerCase() === 'for_revision' ? 'for_revision' : d.status)) : null,
        submitted: Boolean(d.status && d.status.toLowerCase() === 'approved'),
        verified: Boolean(d.status && d.status.toLowerCase() === 'approved'),
        remarks: d.remarks || '',
        file_name: d.file_name,
        file_url: d.file_url,
        url: d.file_url
      }));

      return {
        id: row.id,
        item_no: row.item_no,
        plantilla_item_number: row.item_no,
        new_item_no: row.new_item_no,
        new_item_number: row.new_item_number || row.new_item_no || null,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        email: row.email,
        current_position: row.current_position,
        region: row.region,
        division: row.division,
        station_division: row.division,
        school_id: row.school_id,
        school_name: row.school_name,
        qs_status: row.qs_status,
        qs_eval_result: row.qs_status || 'PENDING',
        stage_of_reclassification: row.stage_of_reclassification,
        target_position: resolvedActualPos,
        actual_position: resolvedActualPos,
        reclass_position: resolvedActualPos,
        is_test: row.is_test,
        reupload: row.reupload,
        created_at: row.created_at,
        updated_at: row.updated_at,
        document_checklist: documentChecklist,
        assessment: {
          education: 'Bachelor of Science in Psychology / Guidance Counseling',
          years_experience: 5.0,
          hours_of_training: 40.0,
          eligibility: 'RA 1080 (Registered Guidance Counselor)',
          documents: rawDocs.map(d => ({
            id: d.id,
            key: d.document_title || d.file_name,
            name: d.file_name || d.document_title,
            label: d.document_title || d.file_name,
            title: d.document_title || d.file_name,
            url: d.file_url,
            status: d.status,
            remarks: d.remarks
          }))
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
    const isRO = isUserRegionalOffice(req);
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;
    const { stage_of_reclassification } = req.body;

    const RO_ALLOWED_STAGES = ['Endorsed to DBM RO', 'For Review', 'Endorsed to RO'];
    const HRMO_STAGES = ['For Review', 'Endorsed to RO', 'Endorsed'];

    if (!isAdmin) {
      if (isRO && !RO_ALLOWED_STAGES.includes(stage_of_reclassification) && stage_of_reclassification !== 'Approved') {
        return res.status(403).json({
          error: `Regional Office personnel can only set stages to: ${RO_ALLOWED_STAGES.join(', ')}`
        });
      }

      if (!isRO && stage_of_reclassification === 'Endorsed to DBM RO') {
        return res.status(403).json({
          error: `Access restricted: Endorsing to "${stage_of_reclassification}" is restricted to Regional Office accounts.`
        });
      }
    }

    if (stage_of_reclassification === 'Approved') {
      const current = await pool.query('SELECT nosca_serial_no, new_item_no FROM reclass_gc WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({ error: 'Incumbent counselor not found' });
      }
      const hasNosca = Boolean(current.rows[0].nosca_serial_no || current.rows[0].new_item_no);
      if (!hasNosca && !isAdmin) {
        return res.status(400).json({
          error: 'The "Approved" stage is automatically set when NOSCA is assigned and cannot be manually selected.'
        });
      }
    } else if (!stage_of_reclassification || !VALID_MANUAL_STAGES.includes(stage_of_reclassification)) {
      return res.status(400).json({
        error: `Invalid stage_of_reclassification. Must be one of: ${VALID_MANUAL_STAGES.join(', ')}`
      });
    }

    const updateQuery = `
      UPDATE reclass_gc
      SET stage_of_reclassification = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [stage_of_reclassification, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    const updatedIncumbent = result.rows[0];

    // Synchronize connected reclass_applications
    await syncIncumbentToApplication(pool, updatedIncumbent, stage_of_reclassification);

    res.json(updatedIncumbent);
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
    const { target_position, reclass_position } = req.body;

    const posInput = (target_position !== undefined ? target_position : reclass_position);
    const targetPosition = (posInput === '' || posInput === undefined) ? null : posInput;

    if (targetPosition !== null && !VALID_POSITIONS.includes(targetPosition)) {
      return res.status(400).json({
        error: `Invalid target_position. Must be one of: ${VALID_POSITIONS.join(', ')} or null/empty`
      });
    }

    const updateQuery = `
      UPDATE reclass_gc
      SET reclass_position = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [targetPosition, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    const updatedIncumbent = result.rows[0];

    // Synchronize reclass_position to connected reclass_applications
    const itemNo = (updatedIncumbent.item_no || '').trim();
    await pool.query(`
      UPDATE reclass_applications
      SET reclass_position = $1,
          updated_at = NOW()
      WHERE reclass_gc_id = $2
         OR ($3 <> '' AND item_no ILIKE $3)
    `, [targetPosition, updatedIncumbent.id, itemNo]);

    res.json({
      ...updatedIncumbent,
      plantilla_item_number: updatedIncumbent.item_no,
      actual_position: updatedIncumbent.reclass_position,
      target_position: updatedIncumbent.reclass_position,
      new_item_number: updatedIncumbent.new_item_no || null
    });
  } catch (error) {
    console.error('[Reclass Controller - updateIncumbentPosition]', error);
    res.status(500).json({ error: error.message || 'Failed to update reclassification position' });
  }
}

/**
 * Save incumbent counselor's document checklist and QS evaluation results
 */
export async function saveIncumbentQsEvaluation(req, res) {
  try {
    if (isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Step 2 (Assessment Workbench) is restricted to Division HRMO.' });
    }

    const { id } = req.params;
    const {
      document_checklist,
      qs_evaluation,
      qs_eval_result,
      evaluator_remarks,
      target_position,
      reclass_position,
      actual_position,
      stage_of_reclassification
    } = req.body;

    const evaluatedBy = req.user?.name || req.user?.fullName || req.user?.username || req.user?.email || 'Division HRMO';
    const evalResult = qs_eval_result || 'PENDING';
    const posParam = actual_position !== undefined ? actual_position : (target_position !== undefined ? target_position : reclass_position);
    const targetPosToSave = (posParam === '' || posParam === undefined) ? null : posParam;

    const updateQuery = `
      UPDATE reclass_gc
      SET qs_status = COALESCE($1, qs_status),
          reclass_position = COALESCE($2, reclass_position),
          stage_of_reclassification = COALESCE($3, stage_of_reclassification),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      evalResult,
      targetPosToSave,
      stage_of_reclassification || null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    // Synchronize reclass_position to reclass_applications
    const updatedInc = result.rows[0];
    if (targetPosToSave) {
      const itemNo = (updatedInc.item_no || '').trim();
      await pool.query(`
        UPDATE reclass_applications
        SET reclass_position = COALESCE($1, reclass_position),
            updated_at = NOW()
        WHERE reclass_gc_id = $2
           OR ($3 <> '' AND item_no ILIKE $3)
      `, [targetPosToSave, id, itemNo]);
    }

    // Persist document evaluation results (Approved / For Revision) into reclass_documents
    if (Array.isArray(document_checklist) && document_checklist.length > 0) {
      const itemNo = (updatedInc.item_no || '').trim();
      for (const doc of document_checklist) {
        const docTitle = doc.shortTitle || doc.label || doc.title || doc.name || 'Document';
        let docStatus = null;
        if (doc.status === 'approved' || doc.status === 'Approved') docStatus = 'Approved';
        else if (doc.status === 'for_revision' || doc.status === 'For Revision') docStatus = 'For Revision';
        else if (doc.submitted && doc.verified) docStatus = 'Approved';

        const docRemarks = doc.remarks !== undefined ? doc.remarks : null;

        const existingDoc = await pool.query(`
          SELECT id FROM reclass_documents
          WHERE plantilla_item_number = $1
            AND (TRIM(LOWER(document_title)) = TRIM(LOWER($2)) OR TRIM(LOWER(file_name)) = TRIM(LOWER($2)))
          LIMIT 1;
        `, [itemNo, docTitle]);

        if (existingDoc.rows.length > 0) {
          await pool.query(`
            UPDATE reclass_documents
            SET status = $1,
                remarks = $2,
                document_title = COALESCE($3, document_title),
                plantilla_item_number = COALESCE(plantilla_item_number, $4),
                updated_at = NOW()
            WHERE id = $5;
          `, [docStatus, docRemarks, docTitle, itemNo, existingDoc.rows[0].id]);
        } else {
          await pool.query(`
            INSERT INTO reclass_documents (
              plantilla_item_number,
              document_title,
              status,
              remarks,
              updated_at
            ) VALUES ($1, $2, $3, $4, NOW());
          `, [itemNo, docTitle, docStatus, docRemarks]);
        }
      }
    }

    // Fetch updated documents from reclass_documents
    const updatedDocsRes = await pool.query(`
      SELECT * FROM reclass_documents 
      WHERE (plantilla_item_number = $1 AND $1 <> '')
      ORDER BY id ASC;
    `, [updatedInc.item_no || '']);

    const updatedChecklist = updatedDocsRes.rows.map(d => ({
      id: d.document_title || d.file_name,
      key: d.document_title || d.file_name,
      label: d.document_title,
      shortTitle: d.document_title,
      status: d.status ? (d.status.toLowerCase() === 'approved' ? 'approved' : (d.status.toLowerCase() === 'for revision' || d.status.toLowerCase() === 'for_revision' ? 'for_revision' : d.status)) : null,
      submitted: Boolean(d.status && d.status.toLowerCase() === 'approved'),
      verified: Boolean(d.status && d.status.toLowerCase() === 'approved'),
      remarks: d.remarks || '',
      file_name: d.file_name,
      file_url: d.file_url,
      url: d.file_url
    }));

    res.json({
      ...updatedInc,
      plantilla_item_number: updatedInc.item_no,
      actual_position: updatedInc.reclass_position,
      target_position: updatedInc.reclass_position,
      new_item_number: updatedInc.new_item_no || null,
      document_checklist: updatedChecklist,
      documents: updatedDocsRes.rows
    });
  } catch (error) {
    console.error('[Reclass Controller - saveIncumbentQsEvaluation]', error);
    res.status(500).json({ error: error.message || 'Failed to save QS evaluation' });
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
    const { plantilla_item_number } = req.body;
    const cleanItemNo = (typeof plantilla_item_number === 'string' && plantilla_item_number.trim()) ? plantilla_item_number.trim() : null;

    client = await pool.connect();
    await client.query('BEGIN');

    // Retrieve incumbent counselor details
    const incRes = await client.query('SELECT * FROM reclass_gc WHERE id = $1', [id]);
    if (incRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }
    const incumbent = incRes.rows[0];

    let updateQuery;
    let queryParams;

    if (cleanItemNo) {
      updateQuery = `
        UPDATE reclass_gc
        SET stage_of_reclassification = 'Approved',
            plantilla_item_number = $1,
            new_item_number = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      queryParams = [cleanItemNo, id];
    } else {
      updateQuery = `
        UPDATE reclass_gc
        SET updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      queryParams = [id];
    }

    const result = await client.query(updateQuery, queryParams);
    const updatedIncumbent = result.rows[0];

    // If cleanItemNo, link and mark item in reclass_item_no as ASSIGNED
    if (cleanItemNo) {
      const updateItemRes = await client.query(
        `UPDATE reclass_item_no
         SET new_item_no_status = 'ASSIGNED',
             reclass_gc_id = $1,
             reclass_at = NOW(),
             updated_at = NOW()
         WHERE new_item_no = $2`,
        [id, cleanItemNo]
      );

      // If the item wasn't in reclass_item_no yet (e.g. manually entered), insert it as ASSIGNED
      if (updateItemRes.rowCount === 0) {
        await client.query(
          `INSERT INTO reclass_item_no (
            new_item_no,
            category,
            position,
            division,
            school_name,
            new_item_no_status,
            reclass_gc_id,
            reclass_at,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', $6, NOW(), NOW(), NOW())`,
          [
            cleanItemNo,
            'ELEMENTARY',
            incumbent.target_position || incumbent.reclass_position || 'School Counselor Associate I',
            incumbent.division || incumbent.station_division || 'SDO Station',
            incumbent.station_division || incumbent.division || 'SDO Station',
            id
          ]
        );
      }

      // Synchronize new_item_no to reclass_applications
      await client.query(`
        UPDATE reclass_applications
        SET new_item_no = $1,
            updated_at = NOW()
        WHERE reclass_gc_id = $2
           OR (item_no IS NOT NULL AND TRIM(LOWER(item_no)) = TRIM(LOWER($3)))
      `, [cleanItemNo, id, incumbent.item_no || incumbent.plantilla_item_number || '']);
    }

    // Synchronize connected reclass_applications
    await syncIncumbentToApplication(client, updatedIncumbent, updatedIncumbent.stage_of_reclassification);

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
        g.item_no,
        g.item_no AS employee_id,
        TRIM(CONCAT(COALESCE(g.first_name, ''), ' ', COALESCE(g.last_name, ''))) AS full_name
      FROM reclass_gc g
      WHERE g.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }

    const itemNo = (result.rows[0].item_no || '').trim();

    const docsRes = await pool.query(`
      SELECT 
        id,
        file_url,
        file_name,
        remarks,
        status,
        document_title,
        uploaded_at,
        updated_at
      FROM reclass_documents
      WHERE plantilla_item_number = $1 AND $1 <> ''
      ORDER BY id ASC;
    `, [itemNo]);

    res.json({
      incumbent_id: result.rows[0].id,
      employee_id: result.rows[0].item_no,
      full_name: result.rows[0].full_name,
      documents: docsRes.rows
    });
  } catch (error) {
    console.error('[Reclass Controller - getIncumbentDocuments]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch incumbent documents' });
  }
}

/**
 * Update single document status and remarks in reclass_documents
 */
export async function updateIncumbentDocumentStatus(req, res) {
  try {
    if (isUserRegionalOffice(req)) {
      return res.status(403).json({ error: 'Access denied: Restricted to Division HRMO.' });
    }
    const { id } = req.params;
    const { document_title, status, remarks } = req.body;

    const gcRes = await pool.query('SELECT item_no FROM reclass_gc WHERE id = $1', [id]);
    if (gcRes.rows.length === 0) {
      return res.status(404).json({ error: 'Incumbent counselor not found' });
    }
    const itemNo = (gcRes.rows[0].item_no || '').trim();

    let docStatus = null;
    if (status === 'approved' || status === 'Approved') docStatus = 'Approved';
    else if (status === 'for_revision' || status === 'For Revision') docStatus = 'For Revision';

    const existingDoc = await pool.query(`
      SELECT id FROM reclass_documents
      WHERE plantilla_item_number = $1
        AND (TRIM(LOWER(document_title)) = TRIM(LOWER($2)) OR TRIM(LOWER(file_name)) = TRIM(LOWER($2)))
      LIMIT 1;
    `, [itemNo, document_title]);

    let savedRow;
    if (existingDoc.rows.length > 0) {
      const upd = await pool.query(`
        UPDATE reclass_documents
        SET status = COALESCE($1, status),
            remarks = COALESCE($2, remarks),
            document_title = COALESCE($3, document_title),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *;
      `, [docStatus, remarks !== undefined ? remarks : null, document_title, existingDoc.rows[0].id]);
      savedRow = upd.rows[0];
    } else {
      const ins = await pool.query(`
        INSERT INTO reclass_documents (
          plantilla_item_number,
          document_title,
          status,
          remarks,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *;
      `, [itemNo, document_title, docStatus, remarks || null]);
      savedRow = ins.rows[0];
    }

    res.json({
      success: true,
      document: savedRow
    });
  } catch (err) {
    console.error('[Reclass Controller - updateIncumbentDocumentStatus]', err);
    res.status(500).json({ error: err.message || 'Failed to update document status' });
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
 * Ingest Reclassification Inventory CSV into reclass_gc
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

    // Find column indexes matching reclass_gc table and legacy formats
    let itemNoIdx = normalizedHeaders.findIndex(h => h.includes('itemno') || h.includes('plantilla') || h.includes('itemnum') || h === 'item');
    let posIdx = normalizedHeaders.findIndex(h => h.includes('currentposition') || h.includes('positiontitle') || (h.includes('position') && !h.includes('reclass') && !h.includes('target')));
    let firstNameIdx = normalizedHeaders.findIndex(h => h.includes('firstname') || h === 'first' || h === 'fname');
    let lastNameIdx = normalizedHeaders.findIndex(h => h.includes('lastname') || h === 'last' || h === 'lname' || h === 'surname');
    let nameIdx = normalizedHeaders.findIndex(h => h.includes('incumbent') || h.includes('fullname') || h === 'name');
    let emailIdx = normalizedHeaders.findIndex(h => h.includes('email') || h.includes('mail'));
    let regionIdx = normalizedHeaders.findIndex(h => h.includes('region'));
    let divisionIdx = normalizedHeaders.findIndex(h => h.includes('division'));
    let schoolIdIdx = normalizedHeaders.findIndex(h => h.includes('schoolid') || h.includes('schid') || h.includes('schoolno'));
    let schoolNameIdx = normalizedHeaders.findIndex(h => h.includes('schoolname') || (h.includes('school') && !h.includes('id')) || h.includes('stationname'));
    let qsStatusIdx = normalizedHeaders.findIndex(h => h.includes('qsstatus') || h.includes('qs'));
    let stageIdx = normalizedHeaders.findIndex(h => h.includes('stageofreclassification') || h.includes('stage'));
    let reclassPosIdx = normalizedHeaders.findIndex(h => h.includes('reclassposition') || h.includes('targetpos') || (h.includes('reclass') && !h.includes('stage')) || h.includes('targetposition'));
    let newItemNoIdx = normalizedHeaders.findIndex(h => h.includes('newitem') || h.includes('newitemno') || h.includes('newplantilla'));
    let isTestIdx = normalizedHeaders.findIndex(h => h.includes('istest') || h === 'test');
    let reuploadIdx = normalizedHeaders.findIndex(h => h.includes('reupload'));
    let remarksIdx = normalizedHeaders.findIndex(h => h.includes('remark') || h.includes('notes'));
    let stationIdx = normalizedHeaders.findIndex(h => h.includes('uacs') || h.includes('station') || h.includes('oper') || h.includes('school'));

    // Fallback to legacy index positions if standard headers were not recognized
    if (itemNoIdx === -1 && nameIdx !== -1) {
      if (itemNoIdx === -1) itemNoIdx = 4;
      if (regionIdx === -1) regionIdx = 0;
      if (divisionIdx === -1) divisionIdx = 1;
      if (stationIdx === -1) stationIdx = 2;
      if (posIdx === -1) posIdx = 5;
      if (nameIdx === -1) nameIdx = 7;
      if (reclassPosIdx === -1) reclassPosIdx = 8;
      if (remarksIdx === -1) remarksIdx = 9;
    }

    const dataRows = parsedRows.slice(1);

    // Validate station matching if division or region is attached to authenticated user
    const userRole = req.user?.role;
    const isSuperAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'central_office';
    const userDiv = (req.user?.division || '').trim();
    const userReg = (req.user?.region || '').trim();

    if (!isSuperAdmin && (userDiv || userReg)) {
      const normalizeStation = (str) => {
        if (!str) return '';
        return String(str)
          .toUpperCase()
          .replace(/DIVISION\s+OF\s+/gi, '')
          .replace(/CITY\s+OF\s+/gi, '')
          .replace(/SDO\s+/gi, '')
          .replace(/[^A-Z0-9]/g, '')
          .trim();
      };

      const normUserDiv = normalizeStation(userDiv);
      const normUserReg = normalizeStation(userReg);

      const isMatch = (rowVal, normUser) => {
        if (!normUser) return true;
        if (!rowVal || !rowVal.trim()) return false;
        const normRow = normalizeStation(rowVal);
        if (normRow === normUser) return true;
        if (normRow.includes(normUser) || normUser.includes(normRow)) return true;
        if ((normUser === 'NCR' || normUser.includes('NCR')) && (normRow.includes('NCR') || normRow.includes('NATIONALCAPITAL'))) return true;
        if ((normUser.includes('IVA') || normUser.includes('CALABARZON')) && (normRow.includes('IVA') || normRow.includes('CALABARZON'))) return true;
        return false;
      };

      const mismatches = [];
      dataRows.forEach((row, idx) => {
        if (!row.some(c => c && c.trim().length > 0)) return;
        const rowReg = regionIdx !== -1 ? row[regionIdx] : '';
        const rowDiv = divisionIdx !== -1 ? row[divisionIdx] : '';
        const regMatches = isMatch(rowReg, normUserReg);
        const divMatches = isMatch(rowDiv, normUserDiv);
        if (!regMatches || !divMatches) {
          mismatches.push({
            rowNumber: idx + 2,
            itemNo: (itemNoIdx !== -1 && row[itemNoIdx]) ? row[itemNoIdx] : `Row #${idx + 2}`,
            foundRegion: rowReg || 'MISSING',
            foundDivision: rowDiv || 'MISSING'
          });
        }
      });

      if (mismatches.length > 0) {
        return res.status(400).json({
          error: `Station mismatch detected: ${mismatches.length} record(s) do not match your assigned division (${userDiv}). Please check the file and re-upload.`,
          mismatches: mismatches.slice(0, 50),
          expectedDivision: userDiv,
          expectedRegion: userReg
        });
      }
    }

    client = await pool.connect();

    // If replaceExisting is requested, delete old records
    if (replaceExisting) {
      await client.query('TRUNCATE TABLE reclass_gc CASCADE');
    }

    let insertedOrUpdated = 0;
    let vacantCount = 0;
    let abolitionCount = 0;
    let forReviewCount = 0;

    // Deduplicate within the uploaded dataset so item_no never repeats in reclass_gc
    const seenItemNos = new Map();
    const deduplicatedDataRows = [];

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const rawItem = itemNoIdx !== -1 && row[itemNoIdx] ? String(row[itemNoIdx]).trim().toUpperCase() : null;
      if (rawItem && rawItem !== '#N/A' && rawItem !== 'VACANT') {
        if (seenItemNos.has(rawItem)) {
          // Keep the latest row values for this item_no
          const prevIdx = seenItemNos.get(rawItem);
          deduplicatedDataRows[prevIdx] = row;
        } else {
          seenItemNos.set(rawItem, deduplicatedDataRows.length);
          deduplicatedDataRows.push(row);
        }
      } else {
        deduplicatedDataRows.push(row);
      }
    }

    const chunkSize = 200;
    for (let i = 0; i < deduplicatedDataRows.length; i += chunkSize) {
      const chunk = deduplicatedDataRows.slice(i, i + chunkSize);
      const values = [];
      const placeholders = [];
      let pIdx = 1;

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const item_no = itemNoIdx !== -1 && row[itemNoIdx] ? String(row[itemNoIdx]).trim() : null;
        const current_position = posIdx !== -1 && row[posIdx] ? String(row[posIdx]).trim() : 'Unassigned';

        let first_name = firstNameIdx !== -1 && row[firstNameIdx] ? String(row[firstNameIdx]).trim() : null;
        let last_name = lastNameIdx !== -1 && row[lastNameIdx] ? String(row[lastNameIdx]).trim() : null;

        if (!first_name && !last_name && nameIdx !== -1 && row[nameIdx]) {
          const rawName = String(row[nameIdx]).trim();
          if (rawName && rawName.toUpperCase() !== '#N/A' && rawName.toUpperCase() !== 'VACANT') {
            if (rawName.includes(',')) {
              const parts = rawName.split(',');
              last_name = parts[0]?.trim() || null;
              first_name = parts.slice(1).join(' ')?.trim() || null;
            } else {
              const parts = rawName.split(' ');
              first_name = parts[0]?.trim() || null;
              last_name = parts.slice(1).join(' ')?.trim() || null;
            }
          }
        }

        const email = emailIdx !== -1 && row[emailIdx] ? String(row[emailIdx]).trim() : null;
        const region = regionIdx !== -1 && row[regionIdx] ? String(row[regionIdx]).trim() : null;
        const division = divisionIdx !== -1 && row[divisionIdx] ? String(row[divisionIdx]).trim() : (stationIdx !== -1 && row[stationIdx] ? String(row[stationIdx]).trim() : null);
        const school_id = schoolIdIdx !== -1 && row[schoolIdIdx] ? String(row[schoolIdIdx]).trim() : null;
        let school_name = schoolNameIdx !== -1 && row[schoolNameIdx] ? String(row[schoolNameIdx]).trim() : null;
        if (!school_name && stationIdx !== -1 && row[stationIdx] && stationIdx !== divisionIdx && stationIdx !== schoolIdIdx) {
          school_name = String(row[stationIdx]).trim();
        }

        let qs_status = qsStatusIdx !== -1 && row[qsStatusIdx] ? String(row[qsStatusIdx]).trim() : '';
        if (!qs_status) {
          qs_status = 'PENDING';
        }

        let stage_of_reclassification = stageIdx !== -1 && row[stageIdx] ? String(row[stageIdx]).trim() : '';
        const remarks = remarksIdx !== -1 && row[remarksIdx] ? String(row[remarksIdx]).trim() : '';

        if (!stage_of_reclassification) {
          const upperRemarks = remarks.toUpperCase();
          const upperName = (nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : '').toUpperCase();
          if ((!first_name && !last_name) || upperName === '#N/A' || upperName === 'VACANT' || upperName === 'UNFILLED') {
            stage_of_reclassification = 'Unfilled / Vacant';
          } else if (upperRemarks.includes('ABOLITION')) {
            stage_of_reclassification = 'Abolition';
          } else {
            stage_of_reclassification = 'For Review';
          }
        }

        if (stage_of_reclassification === 'Unfilled / Vacant') {
          vacantCount++;
        } else if (stage_of_reclassification === 'Abolition') {
          abolitionCount++;
        } else {
          forReviewCount++;
        }

        const rawReclass = reclassPosIdx !== -1 && row[reclassPosIdx] ? String(row[reclassPosIdx]).trim() : '';
        const reclass_position = (rawReclass && rawReclass.toUpperCase() !== '#N/A') ? rawReclass : null;

        const new_item_no = newItemNoIdx !== -1 && row[newItemNoIdx] ? String(row[newItemNoIdx]).trim() : null;

        const rawTest = isTestIdx !== -1 && row[isTestIdx] ? String(row[isTestIdx]).toLowerCase().trim() : '';
        const is_test = ['true', '1', 'yes', 't'].includes(rawTest);

        const rawReupload = reuploadIdx !== -1 && row[reuploadIdx] ? String(row[reuploadIdx]).toLowerCase().trim() : '';
        const reupload = ['true', '1', 'yes', 't'].includes(rawReupload);

        placeholders.push(
          `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
        );

        values.push(
          item_no,
          current_position,
          first_name,
          last_name,
          email,
          region,
          division,
          school_id,
          school_name,
          qs_status,
          stage_of_reclassification,
          reclass_position,
          new_item_no,
          is_test,
          reupload
        );
      }

      if (placeholders.length > 0) {
        const query = `
          INSERT INTO reclass_gc (
            item_no,
            current_position,
            first_name,
            last_name,
            email,
            region,
            division,
            school_id,
            school_name,
            qs_status,
            stage_of_reclassification,
            reclass_position,
            new_item_no,
            is_test,
            reupload
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (item_no) DO UPDATE SET
            current_position = EXCLUDED.current_position,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = EXCLUDED.email,
            region = EXCLUDED.region,
            division = EXCLUDED.division,
            school_id = EXCLUDED.school_id,
            school_name = EXCLUDED.school_name,
            qs_status = EXCLUDED.qs_status,
            stage_of_reclassification = EXCLUDED.stage_of_reclassification,
            reclass_position = EXCLUDED.reclass_position,
            new_item_no = COALESCE(EXCLUDED.new_item_no, reclass_gc.new_item_no),
            is_test = EXCLUDED.is_test,
            reupload = EXCLUDED.reupload,
            updated_at = NOW()
        `;
        await client.query(query, values);
        insertedOrUpdated += chunk.length;
      }
    }

    const countRes = await client.query('SELECT COUNT(*) as total FROM reclass_gc');

    res.json({
      success: true,
      message: `Successfully ingested ${insertedOrUpdated} records into reclass_gc from ${fileName || 'official inventory'}.`,
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
 * Stream/download the standard Guidance Counselor Reclassification CSV template matching reclass_gc table
 * Automatically fetches the logged-in user's account region and division to prefill in the template
 */
export async function downloadReclassTemplate(req, res) {
  try {
    let userRegion = '';
    let userDivision = '';

    // 1. Extract from auth token if present
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.id) {
          const userRes = await pool.query('SELECT region, division FROM users WHERE id = $1 LIMIT 1', [decoded.id]);
          if (userRes.rows.length > 0) {
            userRegion = (userRes.rows[0].region || decoded.region || '').trim().toUpperCase();
            userDivision = (userRes.rows[0].division || decoded.division || '').trim().toUpperCase();
          } else {
            userRegion = (decoded.region || '').trim().toUpperCase();
            userDivision = (decoded.division || '').trim().toUpperCase();
          }
        } else if (decoded) {
          userRegion = (decoded.region || '').trim().toUpperCase();
          userDivision = (decoded.division || '').trim().toUpperCase();
        }
      } catch (tokenErr) {
        console.warn('[downloadReclassTemplate] Token verification note:', tokenErr.message);
      }
    }

    // 2. Query param fallbacks
    if (!userRegion && req.query.region) {
      userRegion = String(req.query.region).trim().toUpperCase();
    }
    if (!userDivision && req.query.division) {
      userDivision = String(req.query.division).trim().toUpperCase();
    }

    const cleanCsvCell = (val) => {
      if (!val) return '';
      const str = String(val).trim().toUpperCase();
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = 'item_no,current_position,first_name,last_name,email,region,division,school_id,school_name,reclass_position';
    const lines = [header];

    if (userRegion || userDivision) {
      const templateRow = [
        '', // item_no
        '', // current_position
        '', // first_name
        '', // last_name
        '', // email
        cleanCsvCell(userRegion), // region
        cleanCsvCell(userDivision), // division
        '', // school_id
        '', // school_name
        ''  // reclass_position
      ].join(',');
      lines.push(templateRow);
    }

    const csvContent = lines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="DepEd GC Reclassification Template.csv"');
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
    // Authorized for HRMO, Regional Office, and Admin roles

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
        r.id,
        r.new_item_no AS plantilla_item_number,
        r.new_item_no,
        r.category,
        r.position AS position_title,
        r.position,
        r.division,
        r.region,
        r.school_id,
        r.school_name,
        COALESCE(r.new_item_no_status, 'AVAILABLE') AS assignment_status,
        r.new_item_no_status,
        r.reclass_gc_id AS assigned_to_incumbent_id,
        r.reclass_gc_id,
        r.reclass_at AS assigned_at,
        r.created_at,
        r.updated_at,
        TRIM(CONCAT(COALESCE(g.first_name, ''), ' ', COALESCE(g.last_name, ''))) AS assigned_to_name,
        g.item_no AS assigned_to_employee_id
      FROM reclass_item_no r
      LEFT JOIN reclass_gc g ON (r.reclass_gc_id = g.id OR (r.new_item_no IS NOT NULL AND r.new_item_no = g.new_item_no))
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      query += ` AND (r.new_item_no_status = $${params.length} OR ($${params.length} = 'AVAILABLE' AND (r.new_item_no_status IS NULL OR r.new_item_no_status = 'AVAILABLE')))`;
    }

    if (division && division !== 'ALL') {
      params.push(`%${division}%`);
      query += ` AND r.division ILIKE $${params.length}`;
    }

    query += ` ORDER BY r.id ASC`;

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
    // Authorized for HRMO, Regional Office, and Admin roles

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

      // Check if item already exists in reclass_item_no
      const existing = await client.query(
        'SELECT id, new_item_no_status, reclass_gc_id FROM reclass_item_no WHERE new_item_no = $1 LIMIT 1',
        [trimmedItem]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        await client.query(
          `UPDATE reclass_item_no
           SET division = COALESCE($1, division),
               school_id = COALESCE($2, school_id),
               school_name = COALESCE($3, school_name),
               position = COALESCE($4, position),
               category = COALESCE($5, category),
               updated_at = NOW()
           WHERE id = $6`,
          [divName, schoolId ? String(schoolId) : null, schName, position || 'School Counselor Associate I', itemCategory, row.id]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO reclass_item_no (
            new_item_no,
            category,
            position,
            division,
            school_id,
            school_name,
            new_item_no_status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'AVAILABLE', NOW(), NOW())`,
          [
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

/**
 * Upload official NOSCA (PDF/data/items), archive document, and automatically match
 * NEW Item Numbers to personnel currently in Stage "Endorsed to DBM RO"
 */
export async function uploadNoscaAndMatch(req, res) {
  let client;
  let tempFilePath = null;
  try {
    // Authorized for HRMO, Regional Office, and Admin roles

    const { fileData, fileName, serialNo, division, items: rawItems, schoolName, position } = req.body;
    let items = Array.isArray(rawItems) ? rawItems.map(i => String(i).trim()).filter(Boolean) : [];
    let detectedSerial = (serialNo || '').trim();
    let detectedDivision = (division || '').trim();

    // If fileData is provided and items array is empty, run the python scanner
    if (fileData && typeof fileData === 'string' && items.length === 0) {
      const base64Clean = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const pdfBuffer = Buffer.from(base64Clean, 'base64');
      if (pdfBuffer.length > 0) {
        const tempFileName = `nosca_match_${Date.now()}_${randomUUID().slice(0, 8)}.pdf`;
        tempFilePath = path.join(os.tmpdir(), tempFileName);
        fs.writeFileSync(tempFilePath, pdfBuffer);

        const candidates = [
          path.resolve(process.cwd(), 'scanner.py'),
          path.resolve(__dirname, '../../../../../scanner.py'),
          path.resolve(__dirname, '../../../../scanner.py'),
          path.resolve(__dirname, '../../../scanner.py'),
          path.resolve('c:/Users/SC/OneDrive - Department of Education/Desktop/agap_portal/scanner.py')
        ];
        let scannerPath = candidates.find(p => fs.existsSync(p)) || candidates[0];

        const scanResult = await new Promise((resolve) => {
          const pyProcess = spawn('python', [scannerPath, tempFilePath], { windowsHide: true, timeout: 60000 });
          let stdout = '';
          let stderr = '';
          pyProcess.stdout.on('data', d => stdout += d.toString('utf8'));
          pyProcess.stderr.on('data', d => stderr += d.toString('utf8'));
          pyProcess.on('close', () => {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
              try { fs.unlinkSync(tempFilePath); } catch (_) {}
            }
            const trimmed = stdout.trim();
            const firstBrace = trimmed.indexOf('{');
            const lastBrace = trimmed.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              try {
                resolve(JSON.parse(trimmed.substring(firstBrace, lastBrace + 1)));
              } catch (_) { resolve(null); }
            } else { resolve(null); }
          });
          pyProcess.on('error', () => {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
              try { fs.unlinkSync(tempFilePath); } catch (_) {}
            }
            resolve(null);
          });
        });

        if (scanResult && Array.isArray(scanResult.items) && scanResult.items.length > 0) {
          items = scanResult.items.map(i => String(i).trim()).filter(Boolean);
          if (!detectedSerial && scanResult.serial_no && scanResult.serial_no !== 'UNKNOWN') {
            detectedSerial = scanResult.serial_no;
          }
          if (!detectedDivision && scanResult.division) {
            detectedDivision = scanResult.division;
          }
        }
      }
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No new plantilla items found or provided in the NOSCA upload.' });
    }

    const finalSerial = detectedSerial || `RO-NOSCA-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const finalFileName = fileName || `NOSCA_${finalSerial}.pdf`;
    const finalDivision = detectedDivision || 'Regional Scope';

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Insert into reclassification_nosca_documents (retain document for transaction)
    const docRes = await client.query(`
      INSERT INTO reclassification_nosca_documents (
        serial_no,
        file_name,
        file_url,
        division,
        position_title,
        total_items,
        assigned_count,
        uploaded_by,
        uploaded_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, NOW(), $8)
      RETURNING *;
    `, [
      finalSerial,
      finalFileName,
      fileData && typeof fileData === 'string' && fileData.length < 2000000 ? fileData : null,
      finalDivision,
      position || 'School Counselor Associate I',
      items.length,
      req.user?.fullName || req.user?.username || 'Regional Office',
      JSON.stringify({ itemCount: items.length, originalName: fileName })
    ]);
    const savedDoc = docRes.rows[0];

    // 2. Insert items into reclass_item_no
    for (const item of items) {
      await client.query(`
        INSERT INTO reclass_item_no (
          new_item_no,
          category,
          position,
          division,
          school_name,
          new_item_no_status,
          created_at,
          updated_at
        ) VALUES ($1, 'ELEMENTARY', $2, $3, $4, 'AVAILABLE', NOW(), NOW())
        ON CONFLICT DO NOTHING;
      `, [
        item,
        position || 'School Counselor Associate I',
        finalDivision,
        schoolName || 'Regional Allocation Station'
      ]);
    }

    // 3. AUTOMATIC MATCHING for personnel whose Stage is "Endorsed to DBM RO"
    const sdoCandidatesRes = await client.query(`
      SELECT id, item_no, first_name, last_name, TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name, item_no AS plantilla_item_number, new_item_no AS new_item_number, division
      FROM reclass_gc
      WHERE stage_of_reclassification IN ('Endorsed to DBM RO', 'Approved')
      ORDER BY 
        CASE WHEN new_item_no IS NULL OR new_item_no = '' THEN 0 ELSE 1 END,
        CASE WHEN (division ILIKE '%' || $1 || '%') THEN 0 ELSE 1 END,
        id ASC;
    `, [finalDivision.replace(/^Division of\s+/i, '')]);

    const sdoCandidates = sdoCandidatesRes.rows;
    const pendingCandidates = sdoCandidates.filter(c => !c.new_item_number);

    let matchedCount = 0;
    const matchedPersonnel = [];
    const availableItems = [...items];

    // Match up to available items count
    for (let i = 0; i < Math.min(pendingCandidates.length, availableItems.length); i++) {
      const candidate = pendingCandidates[i];
      const newItemNo = availableItems[i];

      // Update candidate record
      await client.query(`
        UPDATE reclass_gc
        SET new_item_no = $1,
            stage_of_reclassification = 'Approved',
            updated_at = NOW()
        WHERE id = $2;
      `, [newItemNo, candidate.id]);

      // Sync to reclass_applications
      await client.query(`
        UPDATE reclass_applications
        SET new_item_no = $1,
            updated_at = NOW()
        WHERE reclass_gc_id = $2;
      `, [newItemNo, candidate.id]);

      // Mark in reclass_item_no as ASSIGNED
      await client.query(`
        UPDATE reclass_item_no
        SET new_item_no_status = 'ASSIGNED',
            reclass_gc_id = $1,
            reclass_at = NOW(),
            updated_at = NOW()
        WHERE new_item_no = $2;
      `, [candidate.id, newItemNo]);

      matchedCount++;
      matchedPersonnel.push({
        id: candidate.id,
        fullName: candidate.full_name,
        previousItemNumber: candidate.item_no,
        newItemNumber: newItemNo,
        serialNo: finalSerial
      });
    }

    // Update document assigned count
    await client.query(`
      UPDATE reclassification_nosca_documents
      SET assigned_count = $1
      WHERE id = $2;
    `, [matchedCount, savedDoc.id]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `NOSCA "${finalFileName}" uploaded successfully! Extracted ${items.length} item(s) and automatically linked ${matchedCount} candidate(s).`,
      serialNo: finalSerial,
      fileName: finalFileName,
      division: finalDivision,
      totalItems: items.length,
      assignedCount: matchedCount,
      matchedPersonnel,
      documentId: savedDoc.id
    });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    console.error('[Reclass Controller - uploadNoscaAndMatch]', error);
    res.status(500).json({ error: error.message || 'Failed to process NOSCA upload.' });
  } finally {
    if (client) client.release();
  }
}

/**
 * Fetch all archived NOSCA documents and their transaction records
 */
export async function getNoscaDocuments(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.serial_no,
        d.file_name,
        d.file_url,
        d.division,
        d.position_title,
        d.total_items,
        d.assigned_count,
        d.uploaded_by,
        d.uploaded_at,
        COALESCE(d.assigned_count, (
          SELECT COUNT(*) 
          FROM reclass_gc gc 
          WHERE gc.nosca_serial_no = d.serial_no AND gc.new_item_no IS NOT NULL
        )) AS actual_linked_count
      FROM reclassification_nosca_documents d
      ORDER BY d.uploaded_at DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('[Reclass Controller - getNoscaDocuments]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch NOSCA documents' });
  }
}

/**
 * Manually assign, link, or clear a NEW Item No. on an incumbent
 */
export async function updateIncumbentNoscaItem(req, res) {
  let client;
  try {
    const role = String(req.user?.role || '').toLowerCase().trim();
    const userPosition = String(req.user?.position || '').toLowerCase().trim();
    const isRegional = 
      role === 'regional_office' || 
      role === 'regional_director' || 
      (role.includes('regional') && role !== 'admin' && role !== 'superadmin') ||
      userPosition === 'regional office';

    if (isRegional && role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({
        error: 'Access restricted: Assigning plantilla item numbers and appointments is restricted to Division HRMO accounts.'
      });
    }

    const { id } = req.params;
    const { newItemNumber, serialNo, fileName } = req.body;

    client = await pool.connect();
    await client.query('BEGIN');

    const cleanItemNo = (typeof newItemNumber === 'string' && newItemNumber.trim()) ? newItemNumber.trim() : null;

    if (cleanItemNo) {
      await client.query(`
        UPDATE reclass_gc
        SET new_item_no = $1,
            stage_of_reclassification = 'Approved',
            updated_at = NOW()
        WHERE id = $2;
      `, [cleanItemNo, id]);

      await client.query(`
        UPDATE reclass_applications
        SET new_item_no = $1,
            updated_at = NOW()
        WHERE reclass_gc_id = $2;
      `, [cleanItemNo, id]);

      await client.query(`
        INSERT INTO reclass_item_no (
          new_item_no,
          category,
          position,
          new_item_no_status,
          reclass_gc_id,
          reclass_at,
          created_at,
          updated_at
        ) VALUES ($1, 'ELEMENTARY', 'School Counselor Associate I', 'ASSIGNED', $2, NOW(), NOW(), NOW())
        ON CONFLICT DO NOTHING;
      `, [cleanItemNo, id]);

      await client.query(`
        UPDATE reclass_item_no
        SET new_item_no_status = 'ASSIGNED',
            reclass_gc_id = $1,
            reclass_at = NOW(),
            updated_at = NOW()
        WHERE new_item_no = $2;
      `, [id, cleanItemNo]);
    } else {
      // Unlink item
      await client.query(`
        UPDATE reclass_gc
        SET new_item_no = NULL,
            stage_of_reclassification = CASE
              WHEN stage_of_reclassification = 'Approved' THEN 'Endorsed to DBM RO'
              ELSE stage_of_reclassification
            END,
            updated_at = NOW()
        WHERE id = $1;
      `, [id]);

      await client.query(`
        UPDATE reclass_applications
        SET new_item_no = NULL,
            updated_at = NOW()
        WHERE reclass_gc_id = $1;
      `, [id]);

      await client.query(`
        UPDATE reclass_item_no
        SET new_item_no_status = 'AVAILABLE',
            reclass_gc_id = NULL,
            reclass_at = NULL,
            updated_at = NOW()
        WHERE reclass_gc_id = $1;
      `, [id]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: cleanItemNo ? `Linked new item ${cleanItemNo}` : 'Item unlinked successfully' });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[Reclass Controller - updateIncumbentNoscaItem]', error);
    res.status(500).json({ error: error.message || 'Failed to update incumbent NOSCA item.' });
  } finally {
    if (client) client.release();
  }
}



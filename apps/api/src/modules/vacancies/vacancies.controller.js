import { pool } from '../../config/db.js';
import { mapPosition, mapVacancy } from '../../utils/mappers.js';
import { clearDocListCache } from '../applications/apps.controller.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseOrFormatDateParam(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    return val.slice(0, 10);
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function parseOrFormatEndDateParam(val) {
  if (!val) return null;
  const dateStr = typeof val === 'string' ? val.slice(0, 10) : (val instanceof Date ? `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}` : String(val).slice(0, 10));
  return `${dateStr}T23:59:59.999Z`;
}

export async function getPositions(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM positions');
    res.json(rows.map(mapPosition));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

let cachedPositionCols = null;

async function getPositionCols() {
  if (cachedPositionCols) return cachedPositionCols;
  try {
    const { rows } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'positions'"
    );
    const cols = rows.map(r => r.column_name.toLowerCase());
    const exp = cols.includes('min_years_experience') ? 'min_years_experience' : (cols.includes('years_experience') ? 'years_experience' : 'years_experience');
    const train = cols.includes('min_training_hours') ? 'min_training_hours' : (cols.includes('training_hours') ? 'training_hours' : 'training_hours');
    cachedPositionCols = { exp, train };
    return cachedPositionCols;
  } catch (e) {
    return { exp: 'years_experience', train: 'training_hours' };
  }
}

export async function getVacancies(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userId = req.user?.id || req.user?.userId;
    let region = req.user?.region || null;
    let division = req.user?.division || null;
    let userEmail = req.user?.email || null;
    let userRole = req.user?.role || null;

    if (userId) {
      const userQuery = await pool.query('SELECT region, division, email, username, role FROM users WHERE id = $1', [userId]);
      const user = userQuery.rows[0];
      if (user) {
        region = user.region || region;
        division = user.division || division;
        userEmail = user.email || user.username || userEmail;
        userRole = user.role || userRole;
      }
    }

    if (region && division) {
      const { rows: pastDeadlineVacancies } = await pool.query(
        "SELECT id FROM vacancies WHERE status = 'open' AND posting_end < $1 AND UPPER(TRIM(region)) = UPPER(TRIM($2)) AND UPPER(TRIM(division)) = UPPER(TRIM($3))",
        [today, region, division]
      );

      if (pastDeadlineVacancies.length > 0) {
        const pastDeadlineIds = pastDeadlineVacancies.map(v => v.id);
        await pool.query(
          "UPDATE vacancies SET status = 'closed' WHERE id = ANY($1)",
          [pastDeadlineIds]
        );
      }
    }

    const posCols = await getPositionCols();
    const queryValues = [];
    let whereClause = '';

    if (region && division) {
      whereClause = 'WHERE UPPER(TRIM(v.region)) = UPPER(TRIM($1)) AND UPPER(TRIM(v.division)) = UPPER(TRIM($2))';
      queryValues.push(region, division);
    } else if (division) {
      whereClause = 'WHERE UPPER(TRIM(v.division)) = UPPER(TRIM($1))';
      queryValues.push(division);
    }

    const { rows } = await pool.query(`
      SELECT 
        v.id,
        v.position_id,
        v.item_no,
        v.job_cluster_id,
        CASE WHEN v.filling_up_status = 'UNFILLED' THEN v.item_no ELSE '' END as unfilled_item_nos,
        v.title,
        v.school,
        v.division,
        v.region,
        v.status,
        v.school_level,
        v.school_id,
        v.filling_up_status,
        v.doc_fetch_preference,
        v.has_fetched_docs,
        v.doc_fetched_at,
        v.allowed_emails,
        v.posting_start,
        v.posting_end,
        v.salary_grade,
        v.created_at,
        v.updated_at,
        CASE WHEN v.status = 'open' AND v.filling_up_status = 'UNFILLED' THEN 1 ELSE 0 END as open_slots,
        1 as total_slots,
        COALESCE(p.title, v.title) as position_title, 
        p.track as position_track,
        p.required_bachelor_degree as position_required_bachelor_degree,
        p.required_degree_keywords as position_required_degree_keywords,
        p.${posCols.exp} as position_min_years_experience,
        p.${posCols.train} as position_min_training_hours,
        p.eligibility_required as position_eligibility_required
      FROM vacancies v
      LEFT JOIN positions p ON (v.position_id = p.id OR UPPER(TRIM(v.title)) = UPPER(TRIM(p.title)))
      ${whereClause}
      ORDER BY v.created_at DESC
    `, queryValues);

    const normalizedUserEmail = (userEmail || '').trim().toLowerCase();
    const isStaff = userRole === 'admin' || userRole === 'hr_officer';

    res.json(rows.map(r => {
      const mapped = mapVacancy(r);
      let effectiveStatus = mapped.status;
      let effectiveOpenSlots = r.open_slots ? parseInt(r.open_slots) : 0;

      const allowedList = (mapped.allowedEmails || []).map(e => String(e).trim().toLowerCase());
      if (allowedList.length > 0) {
        const isAllowed = Boolean(normalizedUserEmail && allowedList.includes(normalizedUserEmail));
        if (!isAllowed && !isStaff) {
          effectiveStatus = 'closed';
          effectiveOpenSlots = 0;
        }
      }

      return {
        ...mapped,
        status: effectiveStatus,
        openSlots: effectiveOpenSlots,
        totalSlots: r.total_slots ? parseInt(r.total_slots) : 0,
        unfilledItemNos: r.unfilled_item_nos || '',
        position: {
          id: r.position_id,
          title: r.position_title || r.title,
          track: r.position_track || 'Teaching',
          requiredBachelorDegree: r.position_required_bachelor_degree || '',
          requiredDegreeKeywords: Array.isArray(r.position_required_degree_keywords) ? r.position_required_degree_keywords : (r.position_required_degree_keywords ? r.position_required_degree_keywords.split(',') : []),
          minYearsExperience: r.position_min_years_experience || 0,
          minTrainingHours: r.position_min_training_hours || 0,
          eligibilityRequired: r.position_eligibility_required || ''
        }
      };
    }));
  } catch (error) {
    console.error('Error fetching vacancies:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vacancies' });
  }
}

export async function createVacancy(req, res) {
  const { positionId, itemNo, title, school, division: bodyDivision, postingStart, postingEnd, salaryGrade } = req.body;
  try {
    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [req.user.id]);
    const user = userQuery.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const region = user.region || 'NCR';
    const division = user.division || bodyDivision || 'SDO Manila';

    const jobClusterId = crypto.createHash('md5').update(`${positionId}|${division}|${region}`).digest('hex');
    await pool.query(
      `INSERT INTO job_clusters (id, position_id, division, region)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [jobClusterId, positionId, division, region]
    );

    const startD = postingStart ? new Date(postingStart) : null;
    const endD = postingEnd ? new Date(postingEnd) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let initialStatus = 'for_publication';
    if (startD && startD <= today && (!endD || endD >= today)) {
      initialStatus = 'open';
    } else if (endD && endD < today) {
      initialStatus = 'closed';
    } else {
      initialStatus = 'for_publication';
    }

    const id = crypto.randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, school, division, region, status, posting_start, posting_end, salary_grade, job_cluster_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        positionId,
        itemNo,
        title,
        school,
        division,
        region,
        initialStatus,
        parseOrFormatDateParam(postingStart),
        parseOrFormatEndDateParam(postingEnd),
        salaryGrade ? parseInt(salaryGrade) : null,
        jobClusterId
      ]
    );
    res.json(mapVacancy(rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A vacancy with this Item Number already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
}

export async function toggleVacancyStatus(req, res) {
  const { id } = req.params;
  const { status, postingStart, postingEnd, docFetchPreference, allowedEmails } = req.body;
  try {
    const vacCheck = await pool.query('SELECT * FROM vacancies WHERE id = $1', [id]);
    if (vacCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (allowedEmails !== undefined) {
      let sanitizedEmails = [];
      if (Array.isArray(allowedEmails)) {
        sanitizedEmails = allowedEmails
          .map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        sanitizedEmails = Array.from(new Set(sanitizedEmails));
      }
      fields.push(`allowed_emails = $${idx++}`);
      values.push(JSON.stringify(sanitizedEmails));
    }

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);

      if (status === 'open' && docFetchPreference === undefined) {
        fields.push(`doc_fetch_preference = $${idx++}`);
        values.push('RETAIN_OLD');
        fields.push(`has_fetched_docs = $${idx++}`);
        values.push(false);
      }
    }
    if (postingStart !== undefined) {
      fields.push(`posting_start = $${idx++}`);
      values.push(parseOrFormatDateParam(postingStart));
    }
    if (postingEnd !== undefined) {
      fields.push(`posting_end = $${idx++}`);
      values.push(parseOrFormatEndDateParam(postingEnd));
    }
    if (docFetchPreference !== undefined) {
      const prefValue = docFetchPreference === 'RETAIN_OLD' ? 'RETAIN_OLD' : 'FETCH_NEW';
      fields.push(`doc_fetch_preference = $${idx++}`);
      values.push(prefValue);
      if (prefValue === 'FETCH_NEW') {
        fields.push(`has_fetched_docs = $${idx++}`);
        values.push(true);
        fields.push(`doc_fetched_at = $${idx++}`);
        values.push(new Date());

        // When Option A (FETCH_NEW) is selected on Reopen/Open Vacancy:
        // Update document_audit_logs.is_open = true for all applications linked to this vacancy/job cluster
        try {
          await pool.query(
            `UPDATE document_audit_logs
             SET is_open = TRUE
             WHERE application_id IN (
               SELECT a.id 
               FROM applications a
               JOIN vacancies v ON (
                 (a.job_cluster_id IS NOT NULL AND a.job_cluster_id = v.job_cluster_id)
                 OR (v.id = $1)
               )
               WHERE v.id = $1 OR (v.job_cluster_id IS NOT NULL AND v.job_cluster_id = (SELECT job_cluster_id FROM vacancies WHERE id = $1))
             )
             OR applicant_id IN (
               SELECT a.applicant_id::text
               FROM applications a
               JOIN vacancies v ON (
                 (a.job_cluster_id IS NOT NULL AND a.job_cluster_id = v.job_cluster_id)
                 OR (v.id = $1)
               )
               WHERE v.id = $1 OR (v.job_cluster_id IS NOT NULL AND v.job_cluster_id = (SELECT job_cluster_id FROM vacancies WHERE id = $1))
             )`,
            [id]
          );
          console.log(`[Vacancy Controller] 🟢 Option A (FETCH_NEW) selected. Updated document_audit_logs.is_open = true for vacancy "${id}".`);
        } catch (auditUpdateErr) {
          console.error('[Vacancy Controller] Error updating document_audit_logs.is_open:', auditUpdateErr.message);
        }
      }
    }

    if (fields.length === 0) {
      return res.json(mapVacancy(vacCheck.rows[0]));
    }

    values.push(id);
    const query = `UPDATE vacancies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(query, values);
    clearDocListCache();
    res.json(mapVacancy(rows[0] || vacCheck.rows[0]));
  } catch (error) {
    console.error('Error updating vacancy:', error);
    res.status(500).json({ error: error.message || 'Failed to update vacancy status' });
  }
}

export async function fetchVacancyDocuments(req, res) {
  const { id } = req.params;
  try {
    const vacRes = await pool.query('SELECT * FROM vacancies WHERE id = $1', [id]);
    if (vacRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }
    const vac = vacRes.rows[0];

    // Requirement 1 & 2 Guard: Cannot fetch documents for a closed vacancy
    if (vac.status === 'closed') {
      return res.status(400).json({ 
        error: 'Automatic or explicit document fetching cannot run while vacancy status is closed. Please open the vacancy first.' 
      });
    }

    const jobClusterId = vac.job_cluster_id;

    // Requirement 2: Explicit user action fetches documents for all applications in job cluster
    if (jobClusterId) {
      await pool.query(
        `UPDATE vacancies 
         SET doc_fetch_preference = 'FETCH_NEW', has_fetched_docs = TRUE, doc_fetched_at = NOW(), updated_at = NOW() 
         WHERE job_cluster_id = $1`,
        [jobClusterId]
      );
      await pool.query(
        `UPDATE document_audit_logs
         SET is_open = TRUE
         WHERE application_id IN (
           SELECT a.id FROM applications a WHERE a.job_cluster_id = $1
         )
         OR applicant_id IN (
           SELECT a.applicant_id::text FROM applications a WHERE a.job_cluster_id = $1
         )`,
        [jobClusterId]
      );
    } else {
      await pool.query(
        `UPDATE vacancies 
         SET doc_fetch_preference = 'FETCH_NEW', has_fetched_docs = TRUE, doc_fetched_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [id]
      );
      await pool.query(
        `UPDATE document_audit_logs
         SET is_open = TRUE
         WHERE application_id IN (
           SELECT a.id FROM applications a JOIN vacancies v ON (a.job_cluster_id = v.job_cluster_id OR v.id = $1) WHERE v.id = $1
         )
         OR applicant_id IN (
           SELECT a.applicant_id::text FROM applications a JOIN vacancies v ON (a.job_cluster_id = v.job_cluster_id OR v.id = $1) WHERE v.id = $1
         )`,
        [id]
      );
    }

    clearDocListCache();

    const updatedRes = await pool.query('SELECT * FROM vacancies WHERE id = $1', [id]);
    res.json({
      success: true,
      message: 'Latest documents fetched successfully for the job cluster.',
      vacancy: mapVacancy(updatedRes.rows[0])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function scanNosca(req, res) {
  const { fileData, fileName } = req.body;
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    const pageTexts = [];
    const options = {
      pagerender: function(pageData) {
        return pageData.getTextContent()
          .then(function(textContent) {
            let lastY, text = '';
            for (let item of textContent.items) {
              if (lastY == item.transform[5] || !lastY){
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            pageTexts.push(text);
            return text;
          });
      }
    };

    const parseResult = await pdfParse(buffer, options);

    const results = {
      serial_no: "UNKNOWN",
      division: "",
      school_name: "",
      items: [],
      position: "School Counselor Associate I",
      category: "ELEMENTARY",
      count: 0,
      category_breakdown: {
        ELEMENTARY: [],
        JHS: [],
        SHS: [],
        ALS: []
      },
      raw_text: "",
      ai_powered: false
    };

    let fullText = parseResult.text;
    const categoryItemsMap = {
      ELEMENTARY: [],
      JHS: [],
      SHS: [],
      ALS: []
    };
    const allSeenItems = new Set();
    const itemPattern = /(?:OSEC[A-Z0-9\-\s]+)?(?:TCH[0-9]|SPET[0-9]?|SST[0-9]|SP[0-9]?|ADO[0-9]?|AO[0-9]?|SCA[0-9]?|PDO[0-9]?)[A-Z0-9\-\s]+20\d\d/g;
    const fallbackItemPattern = /[A-Z0-9]{2,}\s*[\-\s]\s*[\d]{5,}\s*[\-\s]\s*20\d\d/g;

    let currentPageCat = "ELEMENTARY";

    for (const extracted of pageTexts) {
      const pageLower = extracted.toLowerCase();

      // Determine category for this specific page
      if (pageLower.includes("senior high school") || pageLower.includes("- shs")) {
        currentPageCat = "SHS";
      } else if (pageLower.includes("alternative learning") || pageLower.includes("- als") || pageLower.includes("als ")) {
        currentPageCat = "ALS";
      } else if (pageLower.includes("junior high school") || pageLower.includes("high school") || pageLower.includes("national high")) {
        currentPageCat = "JHS";
        const schoolMatch = extracted.match(/([A-Za-z\s\n]+?(?:National|Memorial|Integrated|Science|Vocational|City)?\s+High\s+School)/i);
        if (schoolMatch && !results.school_name) {
          const rawSchool = schoolMatch[1];
          const cleanSchool = rawSchool.replace(/\s+/g, " ").trim();
          results.school_name = cleanSchool;
        }
      } else if (pageLower.includes("elementary") || pageLower.includes("elem ")) {
        currentPageCat = "ELEMENTARY";
      }

      let itemsFound = extracted.match(itemPattern) || [];
      if (itemsFound.length === 0) {
        itemsFound = extracted.match(fallbackItemPattern) || [];
      }

      const cleanItems = itemsFound.map(i => i.replace(/\s+/g, ""));
      for (const item of cleanItems) {
        if (!allSeenItems.has(item)) {
          allSeenItems.add(item);
          categoryItemsMap[currentPageCat].push(item);
          results.items.push(item);
        }
      }
    }

    results.raw_text = fullText.slice(0, 2000);

    // Perform Smart Regex Extraction for Serial Number & Division
    try {
      // 1. Extract Serial Number
      let serialNo = "UNKNOWN";
      let snMatch = fullText.match(/N[0O]SCA\s+SER[I1L]AL\s+N[0O]?[A-Z]*(?:[\.\s,:-]*)\s*([0-9-oilsbzg]{3,})/i);
      if (!snMatch) {
        snMatch = fullText.match(/SER[I1L]AL\s+N[0O]?[A-Z]*(?:[\.\s,:-]*)\s*([0-9-oilsbzg]{3,})/i);
      }
      if (!snMatch) {
        snMatch = fullText.match(/N[0O]SCA\s+N[0O]?[A-Z]*(?:[\.\s,:-]*)\s*([0-9-oilsbzg]{3,})/i);
      }
      if (!snMatch) {
        snMatch = fullText.match(/([0-9oilsbzg]{6,8}-[0-9oilsbzg]{2}-[0-9oilsbzg]{3})/i);
      }

      if (snMatch) {
        const rawSn = snMatch[1];
        const lookalikeLetters = { 'O': '0', 'I': '1', 'L': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6' };
        const cleanedSn = [...rawSn.toUpperCase()].map(char => lookalikeLetters[char] || char).join("");
        serialNo = cleanedSn;
      }
      results.serial_no = serialNo;
      results.count = results.items.length;

      // 2. Detect Position (fixed fallback or list matching)
      let position = "School Counselor Associate I";
      const posList = ["Teacher I", "Teacher III", "Teacher IV", "Principal I", "AO II", "SCA I", "PDO I"];
      for (const pos of posList) {
        if (fullText.toLowerCase().includes(pos.toLowerCase())) {
          position = pos;
          break;
        }
      }
      results.position = position;

      // 3. Detect Division
      const divMatch = fullText.match(/Division\s+of\s+([A-Za-z\s]+?)(?:\s*-\s*|$)/i);
      if (divMatch) {
        const divClean = divMatch[1].replace("Senior High School", "").replace("ALS", "").trim();
        results.division = divClean;
      }

      // 4. Set Category Breakdown and primary category
      results.category_breakdown = categoryItemsMap;

      let maxCat = "ELEMENTARY";
      let maxCount = -1;
      for (const [cat, items] of Object.entries(categoryItemsMap)) {
        if (items.length > maxCount) {
          maxCount = items.length;
          maxCat = cat;
        }
      }
      if (maxCount > 0) {
        results.category = maxCat;
      }
      results.ai_powered = true;
    } catch (e) {
      results.error = e.message;
    }

    if (results.error) {
      return res.status(400).json({ error: results.error });
    }

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

export async function importNosca(req, res) {
  const { items } = req.body;
  try {
    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [req.user.id]);
    const user = userQuery.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const region = user.region || 'NCR';
    const division = user.division || 'SDO Manila';

    const createdList = [];
    for (const item of items) {
      let positionId = item.positionId;
      if (!positionId && item.title) {
        const { rows: posRows } = await pool.query('SELECT id FROM positions WHERE LOWER(title) = LOWER($1) LIMIT 1', [item.title]);
        if (posRows[0]) {
          positionId = posRows[0].id;
        }
      }

      if (positionId) {
        const { rows: checkPos } = await pool.query('SELECT id FROM positions WHERE id = $1 LIMIT 1', [positionId]);
        if (!checkPos[0]) {
          positionId = '36e9d7c6-a939-4ee9-bc92-c368977a9606';
        }
      } else {
        positionId = '36e9d7c6-a939-4ee9-bc92-c368977a9606';
      }

      let finalSchoolName = item.schoolName || '';
      let finalSchoolId = item.schoolId || null;
      let finalSchoolLevel = item.schoolLevel || null;

      if (finalSchoolLevel === 'JHS' && finalSchoolId) {
        const schoolRes = await pool.query('SELECT school_name FROM agap_schools WHERE school_id = $1 LIMIT 1', [finalSchoolId]);
        if (schoolRes.rows[0]) {
          finalSchoolName = schoolRes.rows[0].school_name;
        }
      } else {
        finalSchoolId = null;
      }

      const jobClusterId = crypto.createHash('md5').update(`${positionId}|${division}|${region}`).digest('hex');
      await pool.query(
        `INSERT INTO job_clusters (id, position_id, division, region)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [jobClusterId, positionId, division, region]
      );

      const id = crypto.randomUUID();
      const { rows: vacRows } = await pool.query(
        `INSERT INTO vacancies (id, position_id, item_no, title, school, division, region, status, school_level, school_id, job_cluster_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          id,
          positionId,
          item.itemNo,
          item.title,
          finalSchoolName,
          division,
          region,
          'closed',
          finalSchoolLevel,
          finalSchoolId,
          jobClusterId
        ]
      );
      createdList.push(mapVacancy(vacRows[0]));
    }
    res.json(createdList);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A vacancy with this Item Number already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
}

export async function autocompleteSchools(req, res) {
  const { q } = req.query;
  if (!q) {
    return res.json([]);
  }
  try {
    const isNumeric = /^\d+$/.test(q);
    let query;
    let params;

    if (isNumeric) {
      // Numerical query: search school_id by prefix match (great for index utilization)
      query = `SELECT school_id, school_name 
               FROM agap_schools 
               WHERE CAST(school_id AS TEXT) LIKE $1
               ORDER BY school_id 
               LIMIT 10;`;
      params = [`${q}%`];
    } else {
      // Text query: search school_name using case-insensitive ILIKE
      query = `SELECT school_id, school_name 
               FROM agap_schools 
               WHERE school_name ILIKE $1
               ORDER BY school_id 
               LIMIT 10;`;
      params = [`%${q}%`];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows.map(r => ({
      schoolId: r.school_id,
      schoolName: r.school_name
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function autocompleteApplicantEmails(req, res) {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json([]);
  }
  try {
    const queryTerm = `%${q.trim()}%`;
    const { rows } = await pool.query(
      `SELECT DISTINCT 
         ap.email_address as email,
         CONCAT_WS(' ', NULLIF(ap.first_name, ''), NULLIF(ap.surname, '')) as name
       FROM applicants ap
       WHERE ap.email_address ILIKE $1 
          OR ap.first_name ILIKE $1 
          OR ap.surname ILIKE $1
       ORDER BY ap.email_address ASC
       LIMIT 10;`,
      [queryTerm]
    );
    res.json(rows.filter(r => r.email && r.email.trim()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteVacancy(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM vacancies WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }
    res.json({ success: true, message: 'Vacancy deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

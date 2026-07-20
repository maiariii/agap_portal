import { pool } from '../../config/db.js';
import { mapPosition, mapVacancy } from '../../utils/mappers.js';
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

export async function getPositions(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM positions');
    res.json(rows.map(mapPosition));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getVacancies(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userQuery = await pool.query('SELECT region, division FROM users WHERE id = $1', [req.user.id]);
    const user = userQuery.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { region, division } = user;

    const { rows: expiredVacancies } = await pool.query(
      "SELECT id FROM vacancies WHERE status = 'open' AND posting_end < $1 AND region = $2 AND division = $3",
      [today, region, division]
    );

    if (expiredVacancies.length > 0) {
      const expiredIds = expiredVacancies.map(v => v.id);
      await pool.query(
        "UPDATE vacancies SET status = 'closed' WHERE id = ANY($1)",
        [expiredIds]
      );
    }

    const { rows } = await pool.query(`
      SELECT 
        v.job_cluster_id as id,
        v.position_id,
        string_agg(v.item_no, ', ') as item_no,
        string_agg(v.item_no, ', ') FILTER (WHERE v.filling_up_status = 'UNFILLED') as unfilled_item_nos,
        v.title,
        CASE WHEN COUNT(DISTINCT v.school) > 1 THEN 'Multiple Schools' ELSE MAX(v.school) END as school,
        v.division,
        v.region,
        CASE WHEN COUNT(*) FILTER (WHERE v.status = 'open') > 0 THEN 'open' ELSE 'closed' END as status,
        CASE WHEN COUNT(*) FILTER (WHERE v.filling_up_status = 'UNFILLED') > 0 THEN 'UNFILLED' ELSE 'FILLED' END as filling_up_status,
        MIN(v.posting_start) as posting_start,
        MAX(v.posting_end) as posting_end,
        MAX(v.salary_grade) as salary_grade,
        MIN(v.created_at) as created_at,
        MAX(v.updated_at) as updated_at,
        COUNT(*) FILTER (WHERE v.status = 'open' AND v.filling_up_status = 'UNFILLED') as open_slots,
        COUNT(*) as total_slots,
        p.title as position_title, p.track as position_track,
        p.required_bachelor_degree as position_required_bachelor_degree,
        p.required_degree_keywords as position_required_degree_keywords,
        p.min_years_experience as position_min_years_experience,
        p.min_training_hours as position_min_training_hours,
        p.eligibility_required as position_eligibility_required
      FROM vacancies v
      JOIN positions p ON v.position_id = p.id
      WHERE v.region = $1 AND v.division = $2
      GROUP BY v.job_cluster_id, v.position_id, v.title, v.division, v.region,
               p.title, p.track, p.required_bachelor_degree, p.required_degree_keywords,
               p.min_years_experience, p.min_training_hours, p.eligibility_required
    `, [region, division]);

    res.json(rows.map(r => ({
      ...mapVacancy(r),
      openSlots: r.open_slots ? parseInt(r.open_slots) : 0,
      totalSlots: r.total_slots ? parseInt(r.total_slots) : 0,
      unfilledItemNos: r.unfilled_item_nos || '',
      position: {
        id: r.position_id,
        title: r.position_title,
        track: r.position_track,
        requiredBachelorDegree: r.position_required_bachelor_degree,
        requiredDegreeKeywords: Array.isArray(r.position_required_degree_keywords) ? r.position_required_degree_keywords : (r.position_required_degree_keywords ? r.position_required_degree_keywords.split(',') : []),
        minYearsExperience: r.position_min_years_experience,
        minTrainingHours: r.position_min_training_hours,
        eligibilityRequired: r.position_eligibility_required
      }
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
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
        'open',
        postingStart ? new Date(postingStart) : null,
        postingEnd ? new Date(postingEnd) : null,
        salaryGrade ? parseInt(salaryGrade) : null,
        jobClusterId
      ]
    );
    res.json(mapVacancy(rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function toggleVacancyStatus(req, res) {
  const { id } = req.params;
  const { status, postingStart, postingEnd } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (postingStart !== undefined) {
      fields.push(`posting_start = $${idx++}`);
      values.push(postingStart ? new Date(postingStart) : null);
    }
    if (postingEnd !== undefined) {
      fields.push(`posting_end = $${idx++}`);
      values.push(postingEnd ? new Date(postingEnd) : null);
    }

    values.push(id);
    const query = `UPDATE vacancies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(query, values);
    res.json(mapVacancy(rows[0]));
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
        const { rows: posRows } = await pool.query('SELECT * FROM positions WHERE title = $1 LIMIT 1', [item.title]);
        let pos = posRows[0];
        if (!pos) {
          const newPosId = crypto.randomUUID();
          const { rows: newPosRows } = await pool.query(
            `INSERT INTO positions (id, title, track, required_bachelor_degree, required_degree_keywords, min_years_experience, min_training_hours, eligibility_required)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
              newPosId,
              item.title,
              'administrative',
              "Relevant bachelor's degree",
              ['degree', 'bachelor'],
              0,
              0,
              'Career Service Professional'
            ]
          );
          pos = newPosRows[0];
        }
        positionId = pos.id;
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

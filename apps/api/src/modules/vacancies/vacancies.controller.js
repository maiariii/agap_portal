import { pool } from '../../config/db.js';
import { mapPosition, mapVacancy } from '../../utils/mappers.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
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

    const { rows: expiredVacancies } = await pool.query(
      "SELECT id FROM vacancies WHERE status = 'open' AND posting_end < $1",
      [today]
    );

    if (expiredVacancies.length > 0) {
      const expiredIds = expiredVacancies.map(v => v.id);
      await pool.query(
        "UPDATE vacancies SET status = 'closed' WHERE id = ANY($1)",
        [expiredIds]
      );
    }

    const { rows } = await pool.query(`
      SELECT v.*, p.title as position_title, p.track as position_track,
             p.required_bachelor_degree as position_required_bachelor_degree,
             p.required_degree_keywords as position_required_degree_keywords,
             p.min_years_experience as position_min_years_experience,
             p.min_training_hours as position_min_training_hours,
             p.eligibility_required as position_eligibility_required
      FROM vacancies v
      JOIN positions p ON v.position_id = p.id
    `);

    res.json(rows.map(r => ({
      ...mapVacancy(r),
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
  const { positionId, itemNo, title, school, location, postingStart, postingEnd, salaryGrade } = req.body;
  try {
    const id = crypto.randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, school, location, region, status, posting_start, posting_end, salary_grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        positionId,
        itemNo,
        title,
        school,
        location,
        'NCR',
        'open',
        postingStart ? new Date(postingStart) : null,
        postingEnd ? new Date(postingEnd) : null,
        salaryGrade ? parseInt(salaryGrade) : null
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

  const rootDir = path.resolve(__dirname, '../../../../../');
  const scannerPath = path.join(rootDir, 'scanner.py');
  const tempFilename = `temp_${Date.now()}_${fileName || 'nosca.pdf'}`;
  const tempFilePath = path.join(rootDir, tempFilename);

  try {
    const buffer = Buffer.from(fileData, 'base64');
    fs.writeFileSync(tempFilePath, buffer);

    exec(`python "${scannerPath}" "${tempFilePath}"`, (error, stdout, stderr) => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }

      if (error) {
        console.error(`Exec error: ${error}`);
        return res.status(500).json({ error: `Scanning failed: ${stderr || error.message}` });
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          return res.status(400).json({ error: parsed.error });
        }
        res.json(parsed);
      } catch (parseError) {
        console.error(`Failed to parse scanner output: ${stdout}`);
        res.status(500).json({ error: 'Failed to parse scanner output' });
      }
    });
  } catch (error) {
    console.error(error);
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (_) {}
    res.status(500).json({ error: error.message });
  }
}

export async function importNosca(req, res) {
  const { items } = req.body;
  try {
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

      const id = crypto.randomUUID();
      const { rows: vacRows } = await pool.query(
        `INSERT INTO vacancies (id, position_id, item_no, title, school, location, region, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          id,
          positionId,
          item.itemNo,
          item.title,
          '',
          'SDO Manila',
          'NCR',
          'closed'
        ]
      );
      createdList.push(mapVacancy(vacRows[0]));
    }
    res.json(createdList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

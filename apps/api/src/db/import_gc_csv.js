import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvPath = path.resolve(__dirname, '../../../../Inventory of Application for GC Reclass(Sheet2)2.csv');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function importInventoryCSV() {
  console.log('[CSV Import] Starting import from:', csvPath);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const client = await pool.connect();

  try {
    // 1. Ensure table and columns exist
    console.log('[CSV Import] Ensuring schema columns exist on incumbent_guidance_counselors...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS incumbent_guidance_counselors (
        id SERIAL PRIMARY KEY,
        employee_id TEXT UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        current_position VARCHAR(255) NOT NULL,
        station_division VARCHAR(255) NOT NULL,
        stage_of_reclassification VARCHAR(100) NOT NULL DEFAULT 'For Review',
        reclass_position VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE incumbent_guidance_counselors
        ADD COLUMN IF NOT EXISTS region VARCHAR(255),
        ADD COLUMN IF NOT EXISTS division VARCHAR(255),
        ADD COLUMN IF NOT EXISTS uacs_oper_dsc TEXT,
        ADD COLUMN IF NOT EXISTS org_cd VARCHAR(100),
        ADD COLUMN IF NOT EXISTS plantilla_item_number VARCHAR(150),
        ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50),
        ADD COLUMN IF NOT EXISTS remarks TEXT;

      CREATE INDEX IF NOT EXISTS idx_incumbent_item_no ON incumbent_guidance_counselors(plantilla_item_number);
      CREATE INDEX IF NOT EXISTS idx_incumbent_region ON incumbent_guidance_counselors(region);
      CREATE INDEX IF NOT EXISTS idx_incumbent_division ON incumbent_guidance_counselors(division);
    `);

    // Remove dummy sample records if any
    await client.query("DELETE FROM incumbent_guidance_counselors WHERE employee_id LIKE 'EMP-GC-%'");

    // 2. Read and parse CSV
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let rowIndex = 0;
    let headers = [];
    const rows = [];

    for await (const line of rl) {
      if (!line.trim()) continue;
      const parsed = parseCSVLine(line);
      if (rowIndex === 0) {
        headers = parsed;
      } else {
        rows.push(parsed);
      }
      rowIndex++;
    }

    console.log(`[CSV Import] Parsed ${rows.length} records from CSV. Batch inserting into database...`);

    // 3. Batch insert (chunks of 200)
    const chunkSize = 200;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = [];
      const placeholders = [];
      let pIdx = 1;

      for (const row of chunk) {
        // Headers: REGION, DIVISION, UACS_OPER_DSC, ORG_CD, PLANTILLA ITEM NUMBER, POSITION TITLE, SALARY GRADE, INCUMBENT, RECLASS POSITION, REMARKS
        const region = row[0] || null;
        const division = row[1] || null;
        const uacs_oper_dsc = row[2] || null;
        const org_cd = row[3] || null;
        const plantilla_item_number = row[4] || null;
        const current_position = row[5] || 'Unassigned';
        const salary_grade = row[6] || null;
        const full_name = row[7] || '#N/A';
        const raw_reclass = row[8] || null;
        const reclass_position = (raw_reclass && raw_reclass !== '#N/A') ? raw_reclass : null;
        const remarks = row[9] || null;

        // Use plantilla_item_number as employee_id to guarantee unique item binding
        const employee_id = plantilla_item_number || `ITEM-${i + placeholders.length + 1}`;
        const station_division = division || uacs_oper_dsc || 'Unknown Station';

        // Stage of reclassification determination
        let stage_of_reclassification = 'For Review';
        if (full_name === '#N/A') {
          stage_of_reclassification = 'Unfilled / Vacant';
        } else if (remarks === 'SUBMITTED FOR ABOLITION') {
          stage_of_reclassification = 'Abolition';
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
          reclass_position = EXCLUDED.reclass_position,
          updated_at = NOW();
      `;

      await client.query(query, values);
      insertedCount += chunk.length;
    }

    console.log(`[CSV Import] Successfully imported ${insertedCount} rows into incumbent_guidance_counselors!`);

    // Verify final count
    const countRes = await client.query('SELECT COUNT(*) as total, COUNT(DISTINCT plantilla_item_number) as unique_items FROM incumbent_guidance_counselors');
    console.log('[CSV Import] Database verification:', countRes.rows[0]);

    return countRes.rows[0];
  } catch (err) {
    console.error('[CSV Import Error]', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run standalone if executed directly
if (process.argv[1] && process.argv[1].endsWith('import_gc_csv.js')) {
  importInventoryCSV()
    .then((res) => {
      console.log('[CSV Import] Finished successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[CSV Import] Failed:', err);
      process.exit(1);
    });
}

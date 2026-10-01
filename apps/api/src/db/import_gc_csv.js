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
    console.log('[CSV Import] Ensuring schema columns exist on reclass_gc...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS reclass_gc (
        id SERIAL PRIMARY KEY,
        item_no VARCHAR(150),
        current_position VARCHAR(255),
        first_name VARCHAR(150),
        last_name VARCHAR(150),
        email VARCHAR(255),
        region VARCHAR(255),
        division VARCHAR(255),
        school_id VARCHAR(50),
        school_name VARCHAR(255),
        qs_status VARCHAR(100),
        stage_of_reclassification VARCHAR(100) DEFAULT 'For Review',
        reclass_position VARCHAR(255),
        new_item_no VARCHAR(150),
        is_test BOOLEAN DEFAULT false,
        reupload BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_reclass_gc_item_no ON reclass_gc(item_no);
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_region ON reclass_gc(region);
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_division ON reclass_gc(division);
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_school_id ON reclass_gc(school_id);
    `);

    // Remove dummy sample records if any
    await client.query("DELETE FROM reclass_gc WHERE employee_id LIKE 'EMP-GC-%'");

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
        const target_position = (raw_reclass && raw_reclass !== '#N/A') ? raw_reclass : null;
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

        let first_name = null;
        let last_name = null;
        if (rawName && rawName.includes(',')) {
          const parts = rawName.split(',');
          last_name = parts[0]?.trim() || null;
          first_name = parts.slice(1).join(' ')?.trim() || null;
        } else if (rawName) {
          const parts = rawName.split(' ');
          first_name = parts[0]?.trim() || null;
          last_name = parts.slice(1).join(' ')?.trim() || null;
        }

        const school_name = uacs_oper_dsc || null;
        const school_id = null;

        placeholders.push(
          `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
        );

        values.push(
          plantilla_item_number || null,
          current_position,
          first_name,
          last_name,
          null, // email
          region,
          division,
          school_id,
          school_name,
          'PENDING', // qs_status
          stage_of_reclassification,
          target_position // reclass_position
        );
      }

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
          reclass_position
        ) VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);
      insertedCount += chunk.length;
    }

    console.log(`[CSV Import] Successfully imported ${insertedCount} rows into reclass_gc!`);

    // Verify final count
    const countRes = await client.query('SELECT COUNT(*) as total, COUNT(DISTINCT plantilla_item_number) as unique_items FROM reclass_gc');
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

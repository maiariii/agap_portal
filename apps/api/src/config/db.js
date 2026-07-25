import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const { Pool } = pg;

// Force pg driver to parse TIMESTAMP (OID 1114) columns in Asia/Manila (UTC+8) timezone
pg.types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue.replace(' ', 'T') + '+08:00');
});

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && (
    process.env.DATABASE_URL.includes('azure') ||
    process.env.DATABASE_URL.includes('sslmode=require') ||
    process.env.NODE_ENV === 'production'
  )
    ? { rejectUnauthorized: false }
    : false
});

pool.on('connect', (client) => {
  client.query('SET search_path TO public;');
  client.query("SET timezone = 'Asia/Manila';");
});

// Auto-run schema compatibility migrations
(async () => {
  try {
    await pool.query(`
      ALTER TABLE positions ADD COLUMN IF NOT EXISTS min_years_experience INTEGER;
      ALTER TABLE positions ADD COLUMN IF NOT EXISTS min_training_hours INTEGER;
      UPDATE positions SET min_years_experience = COALESCE(min_years_experience, years_experience, 0);
      UPDATE positions SET min_training_hours = COALESCE(min_training_hours, training_hours, 0);
    `);
  } catch (err) {
    console.error('Schema compatibility check error:', err.message);
  }
})();

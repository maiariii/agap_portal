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
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
    ? { rejectUnauthorized: false }
    : false
});

pool.on('connect', (client) => {
  client.query('SET search_path TO public;');
  client.query("SET timezone = 'Asia/Manila';");
});

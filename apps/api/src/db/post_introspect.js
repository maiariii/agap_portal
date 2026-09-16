import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsPath = path.resolve(__dirname, 'schema.ts');
const jsPath = path.resolve(__dirname, 'schema.js');

if (fs.existsSync(tsPath)) {
  let content = fs.readFileSync(tsPath, 'utf8');
  // Sanitize any raw PostgreSQL cast expressions emitted by Drizzle Kit (e.g. '1'::character varying)
  content = content.replace(/::character varying/g, '');
  content = content.replace(/::[a-z_]+/g, '');
  fs.writeFileSync(jsPath, content, 'utf8');
  console.log('[Drizzle] Schema successfully introspected and exported to apps/api/src/db/schema.js');
} else {
  console.warn('[Drizzle] Warning: schema.ts not found. schema.js was not updated.');
}

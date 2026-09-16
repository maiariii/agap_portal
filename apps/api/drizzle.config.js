import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export default defineConfig({
  schema: './src/db/schema.js',
  out: './src/db/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: true,
  },
});

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

/** @type { import("drizzle-kit").Config } */
module.exports = {
  schema: './src/db/schema.js',
  out: './src/db',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  },
};

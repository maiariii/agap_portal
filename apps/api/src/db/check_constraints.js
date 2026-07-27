import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/AGAP-STAGING?sslmode=require'
});

async function checkConstraints() {
  await client.connect();
  const res = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'applications'::regclass;
  `);
  console.log('Applications Table Constraints:');
  console.dir(res.rows, { depth: null });
  await client.end();
}

checkConstraints().catch(console.error);

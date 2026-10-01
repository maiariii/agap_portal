import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Running fix_nosca_and_trigger_issues...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fix trigger on reclass_documents that causes: record "new" has no field "doc_type"
    console.log('[Migration] Dropping broken trigger trg_reclass_documents_uppercase...');
    await client.query(`
      DROP TRIGGER IF EXISTS trg_reclass_documents_uppercase ON reclass_documents;
      DROP FUNCTION IF EXISTS trg_uppercase_reclass_documents() CASCADE;
    `);

    // 2. Ensure trigger trg_reclass_documents_uppercase is dropped
    console.log('[Migration] Ensured reclass_documents trigger is clean.');

    // 4. Update / refresh views reclassification_nosca_items and reclass_new_item_no
    const checkNoscaView = await client.query(`
      SELECT table_type FROM information_schema.tables WHERE table_name = 'reclassification_nosca_items';
    `);
    if (checkNoscaView.rows.length === 0 || checkNoscaView.rows[0].table_type === 'VIEW') {
      await client.query(`CREATE OR REPLACE VIEW reclassification_nosca_items AS SELECT * FROM reclass_item_no;`);
    }

    const checkNewItemView = await client.query(`
      SELECT table_type FROM information_schema.tables WHERE table_name = 'reclass_new_item_no';
    `);
    if (checkNewItemView.rows.length === 0 || checkNewItemView.rows[0].table_type === 'VIEW') {
      await client.query(`CREATE OR REPLACE VIEW reclass_new_item_no AS SELECT * FROM reclass_item_no;`);
    }

    await client.query('COMMIT');
    console.log('[Migration] fix_nosca_and_trigger_issues finished successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] fix_nosca_and_trigger_issues failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('fix_nosca_and_trigger_issues.js')) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

import { pool } from '../config/db.js';

export async function syncNoscaItems() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check count of items in reclass_item_no
    const itemsRes = await client.query('SELECT COUNT(*) FROM reclass_item_no');
    const count = parseInt(itemsRes.rows[0].count, 10);
    console.log(`[Sync] Current items in reclass_item_no: ${count}`);

    if (count === 0) {
      console.log('[Sync] Seeding plantilla items for official NOSCA archive RO-NCR-2024-089...');
      const sampleItems = [
        'OSEC-DECSB-SCA1-300010-2024',
        'OSEC-DECSB-SCA1-300011-2024',
        'OSEC-DECSB-SCA1-300012-2024'
      ];

      for (const itemNo of sampleItems) {
        await client.query(`
          INSERT INTO reclass_item_no (
            new_item_no,
            category,
            position,
            division,
            region,
            school_name,
            new_item_no_status,
            created_at,
            updated_at
          ) VALUES ($1, 'ELEMENTARY', 'School Counselor Associate I', 'MANILA', 'National Capital Region', 'Regional Allocation Station', 'AVAILABLE', NOW(), NOW())
          ON CONFLICT DO NOTHING;
        `, [itemNo]);
      }

      // Also reset assigned_count to 0 in reclassification_nosca_documents since none are assigned yet
      await client.query(`
        UPDATE reclassification_nosca_documents
        SET assigned_count = 0
        WHERE serial_no = 'RO-NCR-2024-089';
      `);

      console.log('[Sync] Successfully seeded 3 available NOSCA plantilla items.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Sync Error]', err);
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('sync_nosca_items_from_docs.mjs')) {
  syncNoscaItems().then(() => pool.end());
}

import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring status and relation columns exist on reclass_documents...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add status column to reclass_documents
    await client.query(`
      ALTER TABLE reclass_documents
      ADD COLUMN IF NOT EXISTS status VARCHAR(50);
    `);

    // Create helpful indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_documents_status ON reclass_documents(status);
      CREATE INDEX IF NOT EXISTS idx_reclass_documents_item_no ON reclass_documents(plantilla_item_number);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully added status column and indexes to reclass_documents!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed to alter reclass_documents:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run standalone if executed directly
if (process.argv[1]?.endsWith('migration_reclass_documents_status.js')) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

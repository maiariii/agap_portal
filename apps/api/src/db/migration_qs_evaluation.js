import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Applying status to reclass_documents and QS columns to reclass_gc...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure status column in reclass_documents
    await client.query(`
      ALTER TABLE reclass_documents
      ADD COLUMN IF NOT EXISTS status VARCHAR(50);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_documents_status ON reclass_documents(status);
      CREATE INDEX IF NOT EXISTS idx_reclass_documents_item_no ON reclass_documents(plantilla_item_number);
    `);

    // 2. Ensure QS evaluation and document_checklist columns in reclass_gc
    await client.query(`
      ALTER TABLE reclass_gc
      ADD COLUMN IF NOT EXISTS document_checklist JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS qs_evaluation JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS qs_eval_result VARCHAR(50) DEFAULT 'PENDING',
      DROP COLUMN IF EXISTS evaluated_by,
      DROP COLUMN IF EXISTS evaluated_at,
      DROP COLUMN IF EXISTS evaluator_remarks;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reclass_gc_qs_eval_result ON reclass_gc(qs_eval_result);
    `);

    // Also do for compatibility view/table incumbent_guidance_counselors if it's a table
    const checkTable = await client.query(`
      SELECT table_type FROM information_schema.tables WHERE table_name = 'incumbent_guidance_counselors'
    `);
    if (checkTable.rows.length > 0 && checkTable.rows[0].table_type === 'BASE TABLE') {
      await client.query(`
        ALTER TABLE incumbent_guidance_counselors
        ADD COLUMN IF NOT EXISTS document_checklist JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS qs_evaluation JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS qs_eval_result VARCHAR(50) DEFAULT 'PENDING',
        DROP COLUMN IF EXISTS evaluated_by,
        DROP COLUMN IF EXISTS evaluated_at,
        DROP COLUMN IF EXISTS evaluator_remarks;
      `);
    }

    await client.query('COMMIT');
    console.log('[Migration] Successfully added status and QS Evaluation columns!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed to add columns:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('migration_qs_evaluation.js')) {
  runMigration()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}

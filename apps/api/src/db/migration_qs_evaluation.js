import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('[Migration] Ensuring QS Evaluation and Document Checklist columns exist in incumbent_guidance_counselors...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE incumbent_guidance_counselors
      ADD COLUMN IF NOT EXISTS document_checklist JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS qs_evaluation JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS qs_eval_result VARCHAR(50) DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS evaluator_remarks TEXT;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_incumbent_qs_result ON incumbent_guidance_counselors(qs_eval_result);
    `);

    await client.query('COMMIT');
    console.log('[Migration] QS Evaluation columns successfully applied!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed to add QS Evaluation columns:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run standalone if executed directly
if (process.argv[1]?.endsWith('migration_qs_evaluation.js')) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

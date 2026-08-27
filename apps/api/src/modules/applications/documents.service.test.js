import { determineDivisionPeriods, fetchApplicantDocumentsFromAuditLogs } from './documents.service.js';
import { pool } from '../../config/db.js';

async function runTests() {
  console.log('=== Running Upload-Time Division Period Eligibility Unit Tests ===\n');

  const testDivisionClosed = 'TEST_DIV_QC_' + Date.now();
  const testDivisionOpen = 'TEST_DIV_BATANGAS_' + Date.now();
  const testDivisionReopened = 'TEST_DIV_REOPENED_' + Date.now();
  const testApplicantId = '8888888';

  try {
    const posRes = await pool.query('SELECT id FROM positions LIMIT 1');
    const validPosId = posRes.rows.length > 0 ? posRes.rows[0].id : 'pos_test';

    // =========================================================================
    // 1. Closed Division Setup (Quezon City Division example)
    // Closed window: 2026-07-01 to 2026-07-20
    // =========================================================================
    const closedStart = new Date('2026-07-01T00:00:00.000Z');
    const closedEnd = new Date('2026-07-20T23:59:59.000Z');

    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-QC1-' || $1, 'QC Vacancy 1', $2, 'Closed', $3, $5, NOW())`,
      ['test-qc-1', testDivisionClosed, closedStart, validPosId, closedEnd]
    );

    // =========================================================================
    // 2. Open Division Setup (Batangas City example: 15 Closed, 20 Open)
    // Open window: 2026-08-01 to 2026-08-31
    // =========================================================================
    const openStart = new Date('2026-08-01T00:00:00.000Z');
    const openEnd = new Date('2026-08-31T23:59:59.000Z');

    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-BAT1-' || $1, 'Batangas Closed Vacancy', $2, 'Closed', $3, $5, NOW()),
       ($6, $4, 'ITEM-BAT2-' || $6, 'Batangas Open Vacancy', $2, 'Open', $3, $5, NOW())`,
      ['test-bat-1', testDivisionOpen, openStart, validPosId, openEnd, 'test-bat-2']
    );

    // =========================================================================
    // 3. Reopened Division Setup
    // Window 1 (Past Open): 2026-07-01 to 2026-07-20
    // Window 2 (Reopened Open): 2026-08-10 to 2026-08-25
    // =========================================================================
    const reopenedStart1 = new Date('2026-07-01T00:00:00.000Z');
    const reopenedEnd1 = new Date('2026-07-20T23:59:59.000Z');
    const reopenedStart2 = new Date('2026-08-10T00:00:00.000Z');
    const reopenedEnd2 = new Date('2026-08-25T23:59:59.000Z');

    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-RE1-' || $1, 'Reopened Vacancy 1', $2, 'Closed', $3, $5, NOW()),
       ($6, $4, 'ITEM-RE2-' || $6, 'Reopened Vacancy 2', $2, 'Open', $7, $8, NOW())`,
      ['test-re-1', testDivisionReopened, reopenedStart1, validPosId, reopenedEnd1, 'test-re-2', reopenedStart2, reopenedEnd2]
    );

    // =========================================================================
    // Mock Audit Log Documents
    // =========================================================================
    await pool.query(
      `INSERT INTO document_audit_logs (applicant_id, document_type, old_blob_url, new_blob_url, created_at) VALUES 
       ($1, 'Letter of Intent', 'http://blob/loi_qc_old.pdf', 'http://blob/loi_qc_new.pdf', '2026-07-10T10:00:00.000Z'::timestamptz),
       ($1, 'Personal Data Sheet', 'http://blob/pds_qc_closed_old.pdf', 'http://blob/pds_qc_closed_new.pdf', '2026-07-25T10:00:00.000Z'::timestamptz),
       ($1, 'Certificate of Eligibility', 'http://blob/elig_bat_old.pdf', 'http://blob/elig_bat_new.pdf', '2026-08-15T10:00:00.000Z'::timestamptz),
       ($1, 'Work Experience Sheet', 'http://blob/work_reopen_old.pdf', 'http://blob/work_reopen_new.pdf', '2026-08-12T10:00:00.000Z'::timestamptz)`,
      [testApplicantId]
    );

    // --- TEST 1: Closed Division (Quezon City Division rule) ---
    // Document 1 (2026-07-10) uploaded while Open -> Eligible, uses old_blob_url
    // Document 2 (2026-07-25) uploaded while Closed -> Ineligible (Excluded)
    const qcPeriods = await determineDivisionPeriods(testDivisionClosed);
    if (!qcPeriods.isClosed || qcPeriods.divisionStatus !== 'Closed') {
      throw new Error('Test 1 Failed: Quezon City Division should be Closed');
    }

    const qcDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionClosed
    });
    console.log(`Test 1 Document Fetch: Fetched ${qcDocsResult.documents.length} doc(s) for Closed division.`);
    
    const hasClosedPeriodDoc = qcDocsResult.documents.some(d => d.document_type === 'Personal Data Sheet');
    const loiDoc = qcDocsResult.documents.find(d => d.document_type === 'Letter of Intent');

    if (hasClosedPeriodDoc) {
      throw new Error('Test 1 Failed: Document uploaded while Closed must be excluded!');
    }
    if (!loiDoc || loiDoc.effective_blob_url !== 'http://blob/loi_qc_old.pdf') {
      throw new Error(`Test 1 Failed: Closed division must use old_blob_url! Got: ${loiDoc?.effective_blob_url}`);
    }
    console.log('Test 1 (Closed Division Uses old_blob_url & Excludes Closed-Period Uploads): PASS\n');

    // --- TEST 2: Open Division (Batangas City rule) ---
    const batPeriods = await determineDivisionPeriods(testDivisionOpen);
    if (batPeriods.isClosed || batPeriods.divisionStatus !== 'Open') {
      throw new Error('Test 2 Failed: Batangas Division should be Open');
    }

    const batDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionOpen
    });
    console.log(`Test 2 Document Fetch: Fetched ${batDocsResult.documents.length} doc(s) for Open division.`);
    const eligDoc = batDocsResult.documents.find(d => d.document_type === 'Certificate of Eligibility');
    if (!eligDoc || eligDoc.effective_blob_url !== 'http://blob/elig_bat_new.pdf') {
      throw new Error(`Test 2 Failed: Open division must fetch new_blob_url! Got: ${eligDoc?.effective_blob_url}`);
    }
    console.log('Test 2 (Open Division Fetches Eligible Open-Period Documents): PASS\n');

    // --- TEST 3: Reopened Division Rule ---
    // Document 2 (uploaded 2026-07-25 while Closed) MUST STAY EXCLUDED even though division is reopened!
    // Document 4 (uploaded 2026-08-12 during Reopened Open window) MUST BE INCLUDED.
    const reDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionReopened
    });
    console.log(`Test 3 Reopened Division Document Fetch: Fetched ${reDocsResult.documents.length} doc(s).`);

    const hasReopenedClosedDoc = reDocsResult.documents.some(d => d.document_type === 'Personal Data Sheet');
    const hasReopenedOpenDoc = reDocsResult.documents.some(d => d.document_type === 'Work Experience Sheet');

    if (hasReopenedClosedDoc) {
      throw new Error('Test 3 Failed: Previously Closed-period uploaded document became eligible upon reopening!');
    }
    if (!hasReopenedOpenDoc) {
      throw new Error('Test 3 Failed: Document uploaded during Reopened Open period was not fetched!');
    }
    console.log('Test 3 (Reopening Division Does NOT Make Closed-Period Documents Eligible): PASS\n');

    console.log('=== ALL UPLOAD-TIME DIVISION PERIOD ELIGIBILITY TESTS PASSED! ===');
  } catch (err) {
    console.error('TEST ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.query(`DELETE FROM vacancies WHERE division IN ($1, $2, $3)`, [testDivisionClosed, testDivisionOpen, testDivisionReopened]);
    await pool.query(`DELETE FROM document_audit_logs WHERE applicant_id = $1`, [testApplicantId]);
    await pool.end();
  }
}

runTests();

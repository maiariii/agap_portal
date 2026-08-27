import { determineDivisionStatus, fetchApplicantDocumentsFromAuditLogs } from './documents.service.js';
import { pool } from '../../config/db.js';

async function runTests() {
  console.log('=== Running Documents Service Unit Tests ===\n');

  const testDivisionClosed = 'TEST_DIV_CLOSED_' + Date.now();
  const testDivisionOpen = 'TEST_DIV_OPEN_' + Date.now();
  const testDivisionMixed = 'TEST_DIV_MIXED_' + Date.now();
  const testApplicantId = '9999999';

  try {
    const posRes = await pool.query('SELECT id FROM positions LIMIT 1');
    const validPosId = posRes.rows.length > 0 ? posRes.rows[0].id : 'pos_test';

    const cutoffDate = new Date('2026-08-01T23:59:59.000Z');

    // Closed Division: 3 closed vacancies
    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-C1-' || $1, 'Vacancy 1', $2, 'Closed', $3, NOW()),
       ($5, $4, 'ITEM-C2-' || $5, 'Vacancy 2', $2, 'closed', $3, NOW()),
       ($6, $4, 'ITEM-C3-' || $6, 'Vacancy 3', $2, 'CLOSED', $3, NOW())`,
      ['test-closed-1', testDivisionClosed, cutoffDate, validPosId, 'test-closed-2', 'test-closed-3']
    );

    // Open Division: 3 open vacancies
    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-O1-' || $1, 'Vacancy 4', $2, 'Open', $3, NOW()),
       ($5, $4, 'ITEM-O2-' || $5, 'Vacancy 5', $2, 'open', $3, NOW()),
       ($6, $4, 'ITEM-O3-' || $6, 'Vacancy 6', $2, 'OPEN', $3, NOW())`,
      ['test-open-1', testDivisionOpen, cutoffDate, validPosId, 'test-open-2', 'test-open-3']
    );

    // Mixed Division: 2 closed, 1 open vacancy
    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-M1-' || $1, 'Vacancy 7', $2, 'Closed', $3, NOW()),
       ($5, $4, 'ITEM-M2-' || $5, 'Vacancy 8', $2, 'Closed', $3, NOW()),
       ($6, $4, 'ITEM-M3-' || $6, 'Vacancy 9', $2, 'Open', $3, NOW())`,
      ['test-mixed-1', testDivisionMixed, cutoffDate, validPosId, 'test-mixed-2', 'test-mixed-3']
    );

    // 2. Setup mock audit log documents for test applicant with distinct old_blob_url and new_blob_url
    await pool.query(
      `INSERT INTO document_audit_logs (applicant_id, document_type, old_blob_url, new_blob_url, created_at) VALUES 
       ($1, 'Letter of Intent', 'http://blob/loi_old.pdf', 'http://blob/loi_new.pdf', '2026-07-20T10:00:00.000Z'::timestamptz),
       ($1, 'Personal Data Sheet', 'http://blob/pds_old.pdf', 'http://blob/pds_new.pdf', '2026-08-15T10:00:00.000Z'::timestamptz)`,
      [testApplicantId]
    );

    // --- TEST 1: All Closed Division ---
    const closedStatus = await determineDivisionStatus(testDivisionClosed);
    console.log('Test 1: All Closed Division Status ->', closedStatus.divisionStatus, closedStatus.isClosed ? 'PASS' : 'FAIL');
    if (!closedStatus.isClosed || closedStatus.divisionStatus !== 'Closed') {
      throw new Error('Test 1 Failed: Expected divisionStatus to be Closed');
    }

    const closedDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionClosed
    });
    console.log(`Test 1 Document Fetch: Fetched ${closedDocsResult.documents.length} doc(s) for Closed division.`);
    const loiClosed = closedDocsResult.documents.find(d => d.document_type === 'Letter of Intent');
    if (!loiClosed || loiClosed.effective_blob_url !== 'http://blob/loi_old.pdf') {
      throw new Error(`Test 1 Failed: Closed division must fetch from old_blob_url! Got: ${loiClosed?.effective_blob_url}`);
    }
    console.log('Test 1 (Closed Division Fetches old_blob_url & Applies Cutoff): PASS\n');

    // --- TEST 2: All Open Division ---
    const openStatus = await determineDivisionStatus(testDivisionOpen);
    console.log('Test 2: All Open Division Status ->', openStatus.divisionStatus, !openStatus.isClosed ? 'PASS' : 'FAIL');
    if (openStatus.isClosed || openStatus.divisionStatus !== 'Open') {
      throw new Error('Test 2 Failed: Expected divisionStatus to be Open');
    }

    const openDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionOpen
    });
    console.log(`Test 2 Document Fetch: Fetched ${openDocsResult.documents.length} doc(s) for Open division.`);
    const loiOpen = openDocsResult.documents.find(d => d.document_type === 'Letter of Intent');
    if (!loiOpen || loiOpen.effective_blob_url !== 'http://blob/loi_new.pdf') {
      throw new Error(`Test 2 Failed: Open division must fetch from new_blob_url! Got: ${loiOpen?.effective_blob_url}`);
    }
    console.log('Test 2 (Open Division Fetches new_blob_url): PASS\n');

    // --- TEST 3: Mixed Closed and Open Division ---
    const mixedStatus = await determineDivisionStatus(testDivisionMixed);
    console.log('Test 3: Mixed Closed/Open Division Status ->', mixedStatus.divisionStatus, !mixedStatus.isClosed ? 'PASS' : 'FAIL');
    if (mixedStatus.isClosed || mixedStatus.divisionStatus !== 'Open') {
      throw new Error('Test 3 Failed: Mixed division should be treated as Open');
    }

    const mixedDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionMixed
    });
    console.log(`Test 3 Document Fetch: Fetched ${mixedDocsResult.documents.length} doc(s) for Mixed division.`);
    const loiMixed = mixedDocsResult.documents.find(d => d.document_type === 'Letter of Intent');
    if (!loiMixed || loiMixed.effective_blob_url !== 'http://blob/loi_new.pdf') {
      throw new Error(`Test 3 Failed: Mixed division should be treated as Open and fetch from new_blob_url! Got: ${loiMixed?.effective_blob_url}`);
    }
    console.log('Test 3 (Mixed Division Treated as Open & Fetches new_blob_url): PASS\n');

    console.log('=== ALL UNIT TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('TEST ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.query(`DELETE FROM vacancies WHERE division IN ($1, $2, $3)`, [testDivisionClosed, testDivisionOpen, testDivisionMixed]);
    await pool.query(`DELETE FROM document_audit_logs WHERE applicant_id = $1`, [testApplicantId]);
    await pool.end();
  }
}

runTests();

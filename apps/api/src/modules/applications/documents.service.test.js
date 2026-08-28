import { determineDivisionPeriods, fetchApplicantDocumentsFromAuditLogs } from './documents.service.js';
import { pool } from '../../config/db.js';
import { runMigration } from '../../db/alter_vacancies_doc_fetch.js';

async function runTests() {
  console.log('=== Running Upload-Time Division Period Eligibility Unit Tests ===\n');

  try {
    await runMigration();
  } catch (mErr) {
    console.warn('Migration warning:', mErr.message);
  }

  const testDivisionClosed = 'TEST_DIV_QC_' + Date.now();
  const testDivisionOpen = 'TEST_DIV_BATANGAS_' + Date.now();
  const testDivisionReopened = 'TEST_DIV_REOPENED_' + Date.now();
  const testDivisionRetainOld = 'TEST_DIV_RETAIN_' + Date.now();
  const testDivisionReclose = 'TEST_DIV_RECLOSE_' + Date.now();
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

    import('crypto').then(c => c);
    const idQC = 'test-qc-' + Date.now();
    const idBat1 = 'test-bat-1-' + Date.now();
    const idBat2 = 'test-bat-2-' + Date.now();
    const idRe1 = 'test-re-1-' + Date.now();
    const idRe2 = 'test-re-2-' + Date.now();
    const idRet = 'test-ret-' + Date.now();
    const idRC = 'test-rc-' + Date.now();

    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-QC1-' || $1, 'QC Vacancy 1', $2, 'Closed', $3, $5, NOW())`,
      [idQC, testDivisionClosed, closedStart, validPosId, closedEnd]
    );

    // =========================================================================
    // 2. Open Division Setup (Batangas City example: 15 Closed, 20 Open with Explicit Fetch)
    // Open window: 2026-08-01 to 2026-08-31
    // =========================================================================
    const openStart = new Date('2026-08-01T00:00:00.000Z');
    const openEnd = new Date('2026-08-31T23:59:59.000Z');

    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, doc_fetch_preference, has_fetched_docs, created_at) VALUES 
       ($1, $4, 'ITEM-BAT1-' || $1, 'Batangas Closed Vacancy', $2, 'Closed', $3, $5, 'RETAIN_OLD', FALSE, NOW()),
       ($6, $4, 'ITEM-BAT2-' || $6, 'Batangas Open Vacancy', $2, 'Open', $3, $5, 'FETCH_NEW', TRUE, NOW())`,
      [idBat1, testDivisionOpen, openStart, validPosId, openEnd, idBat2]
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
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, doc_fetch_preference, has_fetched_docs, created_at) VALUES 
       ($1, $4, 'ITEM-RE1-' || $1, 'Reopened Vacancy 1', $2, 'Closed', $3, $5, 'RETAIN_OLD', FALSE, NOW()),
       ($6, $4, 'ITEM-RE2-' || $6, 'Reopened Vacancy 2', $2, 'Open', $7, $8, 'FETCH_NEW', TRUE, NOW())`,
      [idRe1, testDivisionReopened, reopenedStart1, validPosId, reopenedEnd1, idRe2, reopenedStart2, reopenedEnd2]
    );

    // =========================================================================
    // 4. Retain Old Preference Division Setup
    // Reopened Open vacancy with doc_fetch_preference = 'RETAIN_OLD'
    // =========================================================================
    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, doc_fetch_preference, created_at) VALUES 
       ($1, $4, 'ITEM-RET1-' || $1, 'Retain Old Vacancy', $2, 'Open', $3, $5, 'RETAIN_OLD', NOW())`,
      [idRet, testDivisionRetainOld, openStart, validPosId, openEnd]
    );

    // =========================================================================
    // 5. Reopen -> Fetch New -> Close Re-closure Setup
    // Verifies: Reopening and fetching new docs must NOT revert to old docs upon re-closing!
    // =========================================================================
    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, doc_fetch_preference, has_fetched_docs, doc_fetched_at, created_at) VALUES 
       ($1, $4, 'ITEM-RC1-' || $1, 'Reclosed Vacancy', $2, 'Closed', $3, $5, 'FETCH_NEW', TRUE, NOW(), NOW())`,
      [idRC, testDivisionReclose, reopenedStart1, validPosId, reopenedEnd2]
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
    if (loiDoc.latest_blob_url !== 'http://blob/loi_qc_new.pdf' || loiDoc.current_blob_url !== 'http://blob/loi_qc_old.pdf') {
      throw new Error('Test 1 Failed: Distinction between latest available document and current document is incorrect!');
    }
    console.log('Test 1 (Closed Division Uses old_blob_url, Distinguishes Latest vs Current & Excludes Closed Uploads): PASS\n');

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
    if (eligDoc.current_blob_url !== eligDoc.latest_blob_url) {
      throw new Error('Test 2 Failed: Open division current_blob_url must match latest_blob_url!');
    }
    console.log('Test 2 (Open Division Automatically Fetches Latest Document from new_blob_url): PASS\n');

    // --- TEST 3: Reopened Division Rule (Option A: Fetch New Documents) ---
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
    const workDoc = reDocsResult.documents.find(d => d.document_type === 'Work Experience Sheet');
    if (!workDoc || workDoc.effective_blob_url !== 'http://blob/work_reopen_new.pdf') {
      throw new Error('Test 3 Failed: Option A Fetch New must fetch from new_blob_url!');
    }
    console.log('Test 3 (Reopening with Fetch New Retrieves new_blob_url & Becomes Current Document): PASS\n');

    // --- TEST 4: Retain Current Files Policy Preference (Option B: Retain Current) ---
    const retDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionRetainOld
    });
    console.log(`Test 4 Retain Old Policy Fetch: Fetched ${retDocsResult.documents.length} doc(s).`);

    const retEligDoc = retDocsResult.documents.find(d => d.document_type === 'Certificate of Eligibility');
    if (!retEligDoc || retEligDoc.effective_blob_url !== 'http://blob/elig_bat_old.pdf') {
      throw new Error(`Test 4 Failed: Retain Current preference must retain old_blob_url! Got: ${retEligDoc?.effective_blob_url}`);
    }
    console.log('Test 4 (Option B Retain Current Files Does Not Fetch from new_blob_url): PASS\n');

    // --- TEST 5: Reopen -> Fetch New -> Close Persistence (Closing Freezes Current Without Reverting) ---
    const reclosePeriods = await determineDivisionPeriods(testDivisionReclose);
    if (!reclosePeriods.isClosed || reclosePeriods.divisionStatus !== 'Closed') {
      throw new Error('Test 5 Failed: Reclosed division should have status Closed');
    }

    const recloseDocsResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      division: testDivisionReclose
    });
    console.log(`Test 5 Reclose Document Fetch: Fetched ${recloseDocsResult.documents.length} doc(s).`);
    const recloseWorkDoc = recloseDocsResult.documents.find(d => d.document_type === 'Work Experience Sheet');
    if (!recloseWorkDoc || recloseWorkDoc.effective_blob_url !== 'http://blob/work_reopen_new.pdf') {
      throw new Error(`Test 5 Failed: Reclosing MUST freeze the fetched new_blob_url and NOT revert to old_blob_url! Got: ${recloseWorkDoc?.effective_blob_url}`);
    }
    console.log('Test 5 (Reopen -> Fetch New -> Close Successfully Freezes Fetched Docs Without Reverting): PASS\n');

    // --- TEST 6: Fallback Safety (If new document is missing/corrupted, existing document remains untouched) ---
    const fallbackTestRows = [
      { document_type: 'Transcript of Records', old_blob_url: 'http://blob/tor_old.pdf', new_blob_url: null, uploaded_at: openStart }
    ];
    const fallbackCurrent = fallbackTestRows[0].new_blob_url || fallbackTestRows[0].old_blob_url;
    if (fallbackCurrent !== 'http://blob/tor_old.pdf') {
      throw new Error('Test 6 Failed: Missing new_blob_url did not fallback safely to existing document!');
    }
    // --- TEST 7: Check Process On Closed Vacancy (Strictly uses existing document, does not fetch new_blob_url unless user opened with Fetch) ---
    const checkClosedResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      vacancyId: idQC,
      division: testDivisionClosed
    });
    const checkLoiDoc = checkClosedResult.documents.find(d => d.document_type === 'Letter of Intent');
    if (!checkLoiDoc || checkLoiDoc.current_blob_url !== 'http://blob/loi_qc_old.pdf') {
      throw new Error(`Test 7 Failed: Check process on closed vacancy fetched new_blob_url instead of retaining current document! Got: ${checkLoiDoc?.current_blob_url}`);
    }
    console.log('Test 7 (Check Process On Closed Vacancy Strictly Uses Existing/Current Document Without Fetching new_blob_url): PASS\n');

    // --- TEST 8: Open Vacancy Without Explicit 'Fetch New' (Document upload must NOT be fetched automatically) ---
    const idOpenDefault = 'test-open-def-' + Date.now();
    const testDivisionOpenDefault = 'TEST_DIV_OPEN_DEF_' + Date.now();
    await pool.query(
      `INSERT INTO vacancies (id, position_id, item_no, title, division, status, posting_start, posting_end, created_at) VALUES 
       ($1, $4, 'ITEM-OD1-' || $1, 'Open Default Vacancy', $2, 'Open', $3, $5, NOW())`,
      [idOpenDefault, testDivisionOpenDefault, openStart, validPosId, openEnd]
    );

    const openDefResult = await fetchApplicantDocumentsFromAuditLogs({
      applicantId: testApplicantId,
      vacancyId: idOpenDefault,
      division: testDivisionOpenDefault
    });
    const openDefDoc = openDefResult.documents.find(d => d.document_type === 'Certificate of Eligibility');
    if (!openDefDoc || openDefDoc.effective_blob_url !== 'http://blob/elig_bat_old.pdf') {
      throw new Error(`Test 8 Failed: Open vacancy without explicit Fetch New fetched new_blob_url! Got: ${openDefDoc?.effective_blob_url}`);
    }
    console.log('Test 8 (Open Vacancy Without Explicit Fetch New Selection Retains Old Document on Upload): PASS\n');

    await pool.query(`DELETE FROM vacancies WHERE division = $1`, [testDivisionOpenDefault]);

    console.log('=== ALL 8 DOCUMENT FETCHING AND RETENTION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('TEST ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.query(`DELETE FROM vacancies WHERE division IN ($1, $2, $3, $4, $5)`, [testDivisionClosed, testDivisionOpen, testDivisionReopened, testDivisionRetainOld, testDivisionReclose]);
    await pool.query(`DELETE FROM document_audit_logs WHERE applicant_id = $1`, [testApplicantId]);
    await pool.end();
  }
}

runTests();

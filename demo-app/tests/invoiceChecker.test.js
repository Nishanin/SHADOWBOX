'use strict';

/**
 * invoiceChecker.test.js
 *
 * Tests for invoiceChecker.js using Node.js built-in test runner (node:test).
 *
 * POST-FIX CONTRACT (Phase 4):
 * isDueToday() now extracts the UTC calendar date from a UTC ISO timestamp.
 * Results are timezone-independent: TZ=UTC and TZ=Asia/Calcutta produce
 * identical results for every test case.
 *
 * REGRESSION COVERAGE:
 * The original failure was caused by using local-timezone Date methods on a
 * UTC timestamp near midnight (2024-01-14T23:30:00.000Z). The old test
 * incorrectly asserted IST-local behaviour (Jan 15). The fixed tests assert
 * the correct UTC-calendar behaviour (Jan 14), and verify TZ-invariance
 * explicitly.
 *
 * To confirm TZ-independence, run both:
 *   npm test               (system TZ = Asia/Calcutta)
 *   npm run test:utc       (TZ = UTC)
 * Both must produce: 7 tests, 7 passed, 0 failed.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isDueToday, getInvoicesDueOn } = require('../src/invoiceChecker');

// ---------------------------------------------------------------------------
// Timestamps used in the test suite
//
// EDGE_TIMESTAMP: 2024-01-14T23:30:00.000Z
//   UTC date: 2024-01-14 (Jan 14)
//   IST date (pre-fix bug): 2024-01-15 (Jan 15 — wrong, local-TZ artefact)
//   After fix: correctly treated as Jan 14 in all timezones
//
// SAFE_TIMESTAMP: 2024-01-15T12:00:00.000Z
//   UTC date: 2024-01-15 in every timezone (noon UTC is always Jan 15)
// ---------------------------------------------------------------------------
const EDGE_TIMESTAMP = '2024-01-14T23:30:00.000Z';
const SAFE_TIMESTAMP = '2024-01-15T12:00:00.000Z';
const TARGET_DATE    = '2024-01-15';
const EDGE_UTC_DATE  = '2024-01-14';   // the correct UTC date of EDGE_TIMESTAMP

describe('isDueToday()', () => {

  // -------------------------------------------------------------------------
  // REGRESSION TEST for RC-01
  // The original bug caused this timestamp to be treated as Jan 15 in IST.
  // After the fix, it is correctly identified as Jan 14 UTC in all timezones.
  // -------------------------------------------------------------------------
  test('REGRESSION: edge timestamp 2024-01-14T23:30Z is Jan 14 UTC, not Jan 15 (fix for RC-01)', () => {
    // This timestamp is 2024-01-14 23:30 UTC.
    // Before fix (IST): getDate() returned 15 -> incorrectly matched '2024-01-15'
    // After fix (UTC):  getUTCDate() returns 14 -> correctly does NOT match '2024-01-15'
    const result = isDueToday(EDGE_TIMESTAMP, TARGET_DATE);
    assert.equal(
      result,
      false,
      `isDueToday("${EDGE_TIMESTAMP}", "${TARGET_DATE}") should return false.\n` +
      `${EDGE_TIMESTAMP} is UTC date 2024-01-14, not 2024-01-15.\n` +
      `If this fails, the UTC-date fix may have been reverted to local-TZ methods.\n` +
      `Current TZ: ${process.env.TZ || '(not set - using system default)'}`
    );
  });

  test('edge timestamp is correctly identified as its UTC date (2024-01-14)', () => {
    // Positive regression: the same timestamp IS due on its actual UTC date.
    const result = isDueToday(EDGE_TIMESTAMP, EDGE_UTC_DATE);
    assert.equal(
      result,
      true,
      `isDueToday("${EDGE_TIMESTAMP}", "${EDGE_UTC_DATE}") should return true.\n` +
      `${EDGE_TIMESTAMP} is UTC date ${EDGE_UTC_DATE}.`
    );
  });

  test('returns false for an invoice due on a completely different date', () => {
    // TZ-independent: Jan 1 is never Jan 15 in any timezone
    const result = isDueToday('2024-01-01T12:00:00.000Z', TARGET_DATE);
    assert.equal(result, false, 'Invoice from Jan 1 should not be due on Jan 15');
  });

  test('returns true for a clearly same-day invoice (noon UTC on target date)', () => {
    // Noon UTC on Jan 15 is Jan 15 UTC — safe in all timezones
    const result = isDueToday(SAFE_TIMESTAMP, TARGET_DATE);
    assert.equal(result, true, 'Invoice at noon UTC on Jan 15 should be due on Jan 15');
  });

});

describe('getInvoicesDueOn()', () => {

  // INV-001: 2024-01-14T23:30Z = UTC date 2024-01-14 (NOT due on Jan 15 after fix)
  // INV-002: 2024-01-15T12:00Z = UTC date 2024-01-15 (due on Jan 15)
  // INV-003: 2024-01-16T08:00Z = UTC date 2024-01-16 (not due on Jan 15)
  // INV-004: 2024-01-14T10:00Z = UTC date 2024-01-14 (not due on Jan 15)
  const invoices = [
    { id: 'INV-001', dueAt: '2024-01-14T23:30:00.000Z', amount: 500 },
    { id: 'INV-002', dueAt: '2024-01-15T12:00:00.000Z', amount: 750 },
    { id: 'INV-003', dueAt: '2024-01-16T08:00:00.000Z', amount: 200 },
    { id: 'INV-004', dueAt: '2024-01-14T10:00:00.000Z', amount: 300 },
  ];

  test('returns only INV-002 due on 2024-01-15 (INV-001 is UTC date Jan 14)', () => {
    // Before fix: IST caused INV-001 to appear due on Jan 15 (wrong)
    // After fix:  INV-001 is correctly Jan 14 UTC -> excluded from Jan 15
    const due = getInvoicesDueOn(invoices, TARGET_DATE);
    const ids  = due.map(inv => inv.id).sort();
    assert.deepEqual(
      ids,
      ['INV-002'],
      `Expected only ['INV-002'] due on ${TARGET_DATE}.\n` +
      `Got: [${ids.join(', ')}]\n` +
      `INV-001 (2024-01-14T23:30Z) is UTC date 2024-01-14, not 2024-01-15.\n` +
      `Current TZ: ${process.env.TZ || '(not set - using system default)'}`
    );
  });

  test('returns INV-001 and INV-004 when querying 2024-01-14', () => {
    // Verifies INV-001 is correctly placed on its actual UTC date (Jan 14)
    const due = getInvoicesDueOn(invoices, EDGE_UTC_DATE);
    const ids  = due.map(inv => inv.id).sort();
    assert.deepEqual(
      ids,
      ['INV-001', 'INV-004'],
      `Expected ['INV-001', 'INV-004'] due on ${EDGE_UTC_DATE}.\n` +
      `Got: [${ids.join(', ')}]`
    );
  });

  test('returns correct total amount for invoices due on 2024-01-15 (750, not 1250)', () => {
    // Before fix: IST inflated total to 1250 by wrongly including INV-001 (500)
    // After fix:  only INV-002 (750) is due on Jan 15
    const due   = getInvoicesDueOn(invoices, TARGET_DATE);
    const total = due.reduce((sum, inv) => sum + inv.amount, 0);
    assert.equal(
      total,
      750,
      `Expected total = 750 (only INV-002).\n` +
      `Got: ${total}\n` +
      `If total is 1250, INV-001 is being incorrectly included via local-TZ date extraction.`
    );
  });

});

'use strict';

/**
 * invoiceChecker.test.js
 *
 * Tests for invoiceChecker.js using Node.js built-in test runner (node:test).
 * No external test framework required.
 *
 * KEY TEST: "invoice due at 23:30 UTC on Jan 14 appears due on Jan 15"
 *
 * This test PASSES locally (IST / UTC+5:30) because:
 *   new Date("2024-01-14T23:30:00.000Z").getDate() === 15  (in IST)
 *
 * This test FAILS in a UTC environment because:
 *   new Date("2024-01-14T23:30:00.000Z").getDate() === 14  (in UTC)
 *
 * Reproduce the failure:
 *   TZ=UTC node --test tests/invoiceChecker.test.js
 *   -- or --
 *   npm run test:utc
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isDueToday, getInvoicesDueOn } = require('../src/invoiceChecker');

// ---------------------------------------------------------------------------
// The critical timestamp: Jan 14 at 23:30 UTC
// In IST (UTC+5:30) this is Jan 15 at 05:00 — so "today" is Jan 15  → PASS
// In UTC             this is Jan 14 at 23:30 — so "today" is Jan 14  → FAIL
// ---------------------------------------------------------------------------
const EDGE_TIMESTAMP = '2024-01-14T23:30:00.000Z';
const TARGET_DATE    = '2024-01-15';

describe('isDueToday()', () => {

  test('returns true for an invoice whose UTC time crosses midnight into the target date in local TZ', () => {
    // LOCAL (IST): this should return true — the invoice is due on Jan 15 from the developer's perspective
    // UTC ENVIRONMENT: this will return false, causing the test to fail
    const result = isDueToday(EDGE_TIMESTAMP, TARGET_DATE);
    assert.equal(
      result,
      true,
      `Expected isDueToday("${EDGE_TIMESTAMP}", "${TARGET_DATE}") === true.\n` +
      `Got false — this means the process is running in a timezone where ` +
      `${EDGE_TIMESTAMP} still falls on Jan 14 (e.g. TZ=UTC).\n` +
      `Current TZ: ${process.env.TZ || '(not set — using system default)'}\n` +
      `Resolved local date: ${(() => {
        const d = new Date(EDGE_TIMESTAMP);
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2,'0') + '-' +
               String(d.getDate()).padStart(2,'0');
      })()}`
    );
  });

  test('returns false for an invoice due on a completely different date', () => {
    // This test is TZ-independent: Jan 1 is never Jan 15 in any timezone
    const result = isDueToday('2024-01-01T12:00:00.000Z', TARGET_DATE);
    assert.equal(result, false, 'Invoice from Jan 1 should not be due on Jan 15');
  });

  test('returns true for a clearly same-day invoice (noon UTC on target date)', () => {
    // Noon UTC on Jan 15 is Jan 15 in every timezone from UTC-11 to UTC+14
    const result = isDueToday('2024-01-15T12:00:00.000Z', TARGET_DATE);
    assert.equal(result, true, 'Invoice at noon UTC on Jan 15 should be due on Jan 15');
  });

});

describe('getInvoicesDueOn()', () => {

  const invoices = [
    { id: 'INV-001', dueAt: '2024-01-14T23:30:00.000Z', amount: 500 },  // edge case: crosses midnight into Jan 15 in IST
    { id: 'INV-002', dueAt: '2024-01-15T12:00:00.000Z', amount: 750 },  // safe: noon UTC on Jan 15
    { id: 'INV-003', dueAt: '2024-01-16T08:00:00.000Z', amount: 200 },  // Jan 16 — not due today
    { id: 'INV-004', dueAt: '2024-01-14T10:00:00.000Z', amount: 300 },  // Jan 14 morning UTC — not due today (in any reasonable TZ)
  ];

  test('returns both invoices due on 2024-01-15 (local TZ)', () => {
    // LOCAL (IST): INV-001 and INV-002 should both be returned
    // UTC ENVIRONMENT: only INV-002 is returned → this assertion fails
    const due = getInvoicesDueOn(invoices, TARGET_DATE);
    const ids  = due.map(inv => inv.id).sort();

    assert.deepEqual(
      ids,
      ['INV-001', 'INV-002'],
      `Expected invoices ['INV-001', 'INV-002'] to be due on ${TARGET_DATE}.\n` +
      `Got: [${ids.join(', ')}]\n` +
      `Current TZ: ${process.env.TZ || '(not set — using system default)'}\n` +
      `INV-001 local date: ${(() => {
        const d = new Date('2024-01-14T23:30:00.000Z');
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      })()}`
    );
  });

  test('returns correct total amount for due invoices', () => {
    // LOCAL (IST): INV-001 (500) + INV-002 (750) = 1250
    // UTC ENVIRONMENT: only INV-002 (750) = 750 → this assertion fails
    const due   = getInvoicesDueOn(invoices, TARGET_DATE);
    const total = due.reduce((sum, inv) => sum + inv.amount, 0);

    assert.equal(
      total,
      1250,
      `Expected total due amount = 1250 (INV-001: 500 + INV-002: 750).\n` +
      `Got: ${total}\n` +
      `This indicates INV-001 was excluded because TZ is not IST.`
    );
  });

});

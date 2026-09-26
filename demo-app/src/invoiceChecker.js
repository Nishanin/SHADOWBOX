'use strict';

/**
 * invoiceChecker.js
 *
 * Business logic for determining whether an invoice is due on a specific date.
 *
 * FIX (Phase 4): replaced local-timezone Date methods with UTC equivalents.
 *
 * Root cause (RC-01): isDueToday() previously used getFullYear/getMonth/getDate,
 * which return values in the *local system timezone*. For a UTC ISO timestamp
 * near midnight, this produced a different calendar date depending on the
 * server's TZ environment variable, causing test failures in UTC environments.
 *
 * Fix: use getUTCFullYear/getUTCMonth/getUTCDate so the extracted calendar date
 * is always the UTC date of the timestamp, regardless of server timezone.
 *
 *   TZ=Asia/Kolkata  (before fix)  Jan 14 23:30 UTC  ->  "2024-01-15"
 *   TZ=UTC           (before fix)  Jan 14 23:30 UTC  ->  "2024-01-14"  (FAIL)
 *
 *   TZ=Asia/Kolkata  (after fix)   Jan 14 23:30 UTC  ->  "2024-01-14"  (PASS)
 *   TZ=UTC           (after fix)   Jan 14 23:30 UTC  ->  "2024-01-14"  (PASS)
 */

/**
 * Returns true when the invoice's dueAt timestamp falls on targetDate
 * according to the UTC calendar date of the timestamp.
 *
 * @param {string} isoTimestamp  - ISO 8601 UTC string, e.g. "2024-01-14T23:30:00.000Z"
 * @param {string} targetDate   - YYYY-MM-DD UTC date string to compare against
 * @returns {boolean}
 */
function isDueToday(isoTimestamp, targetDate) {
  const d = new Date(isoTimestamp);

  // FIX: use UTC methods so the result is timezone-independent
  const year  = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day   = String(d.getUTCDate()).padStart(2, '0');

  const utcDateStr = `${year}-${month}-${day}`;
  return utcDateStr === targetDate;
}

/**
 * Filters a list of invoice objects and returns those due on targetDate.
 *
 * @param {Array<{id: string, dueAt: string, amount: number}>} invoices
 * @param {string} targetDate  - YYYY-MM-DD
 * @returns {Array}
 */
function getInvoicesDueOn(invoices, targetDate) {
  return invoices.filter(inv => isDueToday(inv.dueAt, targetDate));
}

module.exports = { isDueToday, getInvoicesDueOn };

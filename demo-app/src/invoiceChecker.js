'use strict';

/**
 * invoiceChecker.js
 *
 * Business logic for determining whether an invoice is due on a specific date.
 *
 * BUG: isDueToday() uses local-timezone Date methods (getFullYear, getMonth,
 * getDate) to extract the calendar date from a UTC ISO timestamp.
 *
 * This means the result depends on the server's TZ environment variable:
 *
 *   TZ=Asia/Kolkata  →  Jan 14 23:30 UTC  =  Jan 15 05:00 IST  →  "2024-01-15"  → PASS
 *   TZ=UTC           →  Jan 14 23:30 UTC  =  Jan 14 23:30 UTC  →  "2024-01-14"  → FAIL
 *
 * The correct fix (NOT applied here) would be to use getUTCFullYear(),
 * getUTCMonth(), getUTCDate() — or to parse with a date library that is
 * timezone-aware.
 */

/**
 * Returns true when the invoice's dueAt timestamp falls on targetDate
 * according to the *local system timezone*.
 *
 * @param {string} isoTimestamp  - ISO 8601 UTC string, e.g. "2024-01-14T23:30:00.000Z"
 * @param {string} targetDate   - YYYY-MM-DD string to compare against
 * @returns {boolean}
 */
function isDueToday(isoTimestamp, targetDate) {
  const d = new Date(isoTimestamp);

  // BUG: these methods return values in the *local* timezone, not UTC
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');

  const localDateStr = `${year}-${month}-${day}`;
  return localDateStr === targetDate;
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

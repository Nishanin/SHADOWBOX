# shadowbox-demo-app

A minimal Node.js application containing a **deliberate, deterministic, environment-dependent bug**.

This app is the subject of the SHADOWBOX investigation workflow — the goal is for IBM Bob to:
1. Detect the failure in the controlled environment
2. Investigate the root cause
3. Reproduce it inside a SHADOWBOX container
4. Propose and verify the fix

---

## The Bug

`src/invoiceChecker.js` contains a function `isDueToday(isoTimestamp, targetDate)` that checks whether an invoice is due on a given calendar date.

The bug is that it uses **local-timezone Date methods** (`getFullYear`, `getMonth`, `getDate`) to extract the calendar date from a UTC ISO timestamp. The result therefore depends entirely on the server's `TZ` environment variable.

### The critical timestamp

```
2024-01-14T23:30:00.000Z
```

| Environment | Local interpretation | isDueToday("…", "2024-01-15") |
|---|---|---|
| `TZ=Asia/Kolkata` (IST, UTC+5:30) | Jan **15** at 05:00 | `true` ✅ PASS |
| `TZ=UTC` | Jan **14** at 23:30 | `false` ❌ FAIL |

---

## Structure

```
demo-app/
├── src/
│   └── invoiceChecker.js    ← application logic with the bug
├── tests/
│   └── invoiceChecker.test.js  ← test that exposes the TZ sensitivity
├── package.json
└── README.md
```

---

## Running the tests

### Prerequisites

```bash
cd demo-app
npm install
```

### LOCAL (should PASS — uses your system TZ)

```bash
npm test
```

### CONTROLLED ENVIRONMENT (should FAIL — simulates UTC server)

```bash
npm run test:utc
# equivalent to:
TZ=UTC node --test tests/invoiceChecker.test.js
# on Windows PowerShell:
$env:TZ="UTC"; node --test tests/invoiceChecker.test.js
```

---

## Expected output

### `npm test` (local, IST)

```
✔ isDueToday() > returns true for an invoice whose UTC time crosses midnight into the target date in local TZ
✔ isDueToday() > returns false for an invoice due on a completely different date
✔ isDueToday() > returns true for a clearly same-day invoice (noon UTC on target date)
✔ getInvoicesDueOn() > returns both invoices due on 2024-01-15 (local TZ)
✔ getInvoicesDueOn() > returns correct total amount for due invoices
ℹ tests 5, pass 5, fail 0
```

### `npm run test:utc` (UTC environment)

```
✖ isDueToday() > returns true for an invoice whose UTC time crosses midnight into the target date in local TZ
✖ getInvoicesDueOn() > returns both invoices due on 2024-01-15 (local TZ)
✖ getInvoicesDueOn() > returns correct total amount for due invoices
ℹ tests 5, pass 2, fail 3
```

---

## The correct fix (NOT applied — for SHADOWBOX to discover)

Replace local-timezone methods with UTC methods:

```js
// BUGGY
const year  = d.getFullYear();
const month = String(d.getMonth() + 1).padStart(2, '0');
const day   = String(d.getDate()).padStart(2, '0');

// CORRECT
const year  = d.getUTCFullYear();
const month = String(d.getUTCMonth() + 1).padStart(2, '0');
const day   = String(d.getUTCDate()).padStart(2, '0');
```

---

## SHADOWBOX relevance

This failure is ideal for automated investigation because:

- **Deterministic**: the same timestamp always produces the same pass/fail split
- **Single root cause**: one three-character change (`getDate` → `getUTCDate`) fixes all failures
- **Environment variable trigger**: `TZ=UTC` is exactly what production Linux servers and Docker containers default to
- **Observable diff**: Bob can compare `process.env.TZ`, `new Date().getTimezoneOffset()`, and the date extraction output between environments
- **Fixable by code change alone**: no infrastructure change required

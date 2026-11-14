# Cisco attendance register

Attendance, lab uptime and weekly reports for Milimani and Coram Deo.

## Enrol learners

1. Sign in, select the academic year (for example, 2027), then select the centre.
2. Open **Add learners / Import Excel**.
3. Enter one full name, or download the Excel template and fill its **Full Name** column.
4. Upload `.xlsx`, `.xls` or `.csv`, review the first-sheet preview, then choose **Import valid learners**.

A one-column list without a heading also works. Files are limited to 5 MB and 1,000 learners. Formula cells, invalid names and duplicate rows are flagged. Existing names in the same centre/year are skipped, including inactive enrolments. Same-name learners within a centre/year require a distinguishing name; this register does not yet have admission numbers. Enrolment batches are transactional and safe to retry.

Each year has a separate learner roster, attendance dates, uptime notes and reports. Existing learner IDs and attendance are retained under 2026. The 2026 timetable retains its original starting week. Later years include scheduled weekdays throughout the calendar year; record school closures using the existing excuse controls.

## Database

The migration under `supabase/migrations` adds academic-year columns and a normalized-name uniqueness constraint, and creates `enrol_learners`. It uses invoker rights and the project's existing authenticated-trainer RLS policies. Anonymous callers cannot execute it. Existing access roles are unchanged. Never place service-role keys in browser files.

The migration was applied to the connected Cisco project. It is a one-time migration, not an idempotent setup script. Older open pages should be reloaded after deployment because the weekly-note conflict key now includes academic year.

Database verification used a rolled-back transaction for batch inserts, retry deduplication, centre/year separation and invalid-batch rejection. Afterwards: 74 original learners, 4,771 attendance records, zero test learners, and no anonymous RPC permission.

## Tests

Run `npm ci` then `npm test`. Parser tests cover actual XLSX/XLS round trips, validation and duplicate handling. DOM tests exercise adding learners, importing CSV and switching year/centre using a simulated database. These are separate from the live database transaction tests.

An optional Playwright script is available at `tests/browser.cjs`; serve the project on port 8765 and run it with Playwright installed. Set `CHROMIUM_PATH` if needed. Browser rendering could not be checked in the development environment because Chromium launch was blocked by its socket restrictions.

SheetJS CE 0.20.3 is vendored from `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`; its Apache 2.0 license is included in `vendor`.

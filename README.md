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

## Appraisal and learner surveys

Open **Appraisal & surveys** from the register, or `appraisal.html` directly. The same Supabase sign-in is used. Choose centre/year and evidence dates. The workspace includes equipment, maintenance, assessments, individual feedback, revision/interventions, teaching impact, management submissions, feedback actions, development and a deadline planner.

Every record edit creates a staff-attributed audit entry. Cancel a mistaken record rather than deleting evidence. Concurrent edits use a version check. Evidence URLs must be HTTPS. Print an individual record or the appraisal summary using **Print / save appraisal PDF**; choose your browser's Save as PDF destination. Submissions record the actual external submission and management feedback; saving does not send email.

Weekly reports now include data insights and intervention plans, and new reports are tagged to the selected centre. Legacy reports remain unassigned because their centre cannot be inferred reliably. The dashboard reports analysis coverage only for explicitly centre-tagged reports. Performance comparisons are percentage-point changes between comparable baseline and latest follow-up scores for a learner/topic; they are not official appraisal grades. Maintenance coverage is based on the required logs actually entered, so missing planned logs must be entered before using the count as a compliance measure.

### Send a learner survey

1. Add learners for the desired centre/year.
2. Open **Learner surveys**, enter a title and closing date, and create the survey.
3. Choose **View answers & links**. Copy each learner's **personal link**, or download the personal-links CSV for distribution.
4. The personal link selects their name and contains their private access code. Alternatively, share the class link and distribute each learner's code separately; the learner chooses their name and enters that code.
5. After submission, open Learner surveys again or Refresh. Use **Read answers** for the named response, the question summary for averages, and **Create follow-up action** to document concerns and resolutions.
6. Close the campaign to stop new submissions. Existing answers remain readable.

The 13 versioned questions cover NetAcad understanding, practical confidence, clarity, demonstrated teaching competence, support, practice time, feedback, fairness, satisfaction, likes, dislikes, difficult topics and improvements. Ratings include a not-applicable option; written answers are optional. Learners are explicitly told that responses are named and visible to authorised staff. Survey links/codes must not be posted publicly. Duplicate submissions are idempotent and do not overwrite the first response.

### Access controls

The migration snapshots the project's existing non-anonymous staff accounts into `appraisal_staff`. New registrations receive no appraisal access. Appraisal records, history, survey invitations and responses have RLS and are inaccessible to anonymous table reads. The learner page has no staff session and uses only token-scoped RPCs. Submission additionally checks the individual invitation secret. SECURITY DEFINER code is contained in the private schema with explicit capability or staff checks; the exposed functions use invoker rights.

Staff dashboards receive update notifications for new evidence and survey responses. The overview refreshes automatically when no record dialog is open. Other screens preserve ongoing work until Refresh is clicked.

### Deployment

The original GitHub Pages URL inherits an unrelated account-level custom-domain redirect and returns a 404. Use the dedicated Sites production address: https://cisco-training-register.glitteringion.chatgpt.site. `npm run build` copies only the public application files into `dist`; database migrations, tests and package files are not served. Vercel project creation was denied by account permissions. The application is deployed with Sites; GitHub remains the canonical source repository and the hosted source is synchronised during releases. The Vercel configuration is retained for future migration.

### Additional validation

`npm test` covers all ten record forms, edit version handling, survey creation, named response display, follow-up actions, survey closure, learner form rendering and safe retry after a submission error. `tests/appraisal-database.sql` runs a rolled-back authenticated/anonymous database test for all record modules, audit history, wrong-centre rejection, invitation snapshots, valid submission, duplicate prevention, wrong codes, missing ratings, private response access and closed links. It does not leave test evidence behind.

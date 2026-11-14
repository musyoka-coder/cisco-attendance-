# Contributing

Use Node 24.22 or later and `npm ci`. Run `npm run lint`, `npm test` and `npm run build` before opening a pull request. Build configuration is explained in README.md.

Keep a behavioral change and its regression tests in the same focused commit. Put mechanical formatting and unrelated refactors in separate commits. Describe the triggering problem, resulting behavior and test evidence in the pull request. Do not manufacture authors, activity, release tags or commits to increase an assessment score.

The browser suite uses a simulated database and never writes to Supabase. Database integration tests are separate: run them only against a disposable staging database with the expected schema and staff fixtures. Do not point CI at production.

## Architecture

- `index.html`: attendance UI and legacy register controller.
- `learner-import.js`: spreadsheet validation and enrolment UI.
- `appraisal-config.js`: form definitions, CSV escaping and assessment comparison.
- `appraisal.js`: staff workflows and Supabase transport.
- `survey.js`: capability-scoped learner survey flow.
- `supabase/migrations`: incremental changes to an existing register database, not a full empty-database bootstrap.
- `scripts/config.cjs`: validated public build configuration.

The next architectural improvement is extracting the legacy inline controller and separating transport from rendering, with regression tests at each boundary. Avoid a wholesale framework rewrite for scoring purposes.

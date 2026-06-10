---
name: DB schema location
description: Where the DB package and schema files live in the monorepo
---

## Rule
DB package is at `lib/db/` (not `packages/db/`). Schema files are in `lib/db/src/schema/` as individual files per table, all exported from `lib/db/src/schema/index.ts`.

## Key tables
- `affiliates` — includes `onboarding_submitted_at` column (added via raw SQL)
- `onboarding_responses` — in `lib/db/src/schema/onboarding.ts`, exported as `onboardingResponsesTable`
- `email_templates` — in `lib/db/src/schema/email_templates.ts`, exported as `emailTemplatesTable`
- `system_config` — starts empty; ensureConfig() in config.ts seeds default row on first GET

**Why:** The monorepo uses `lib/` not `packages/` for shared libraries. This caused confusion when grepping for schema files.

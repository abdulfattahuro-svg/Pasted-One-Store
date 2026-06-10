# OneStore Affiliate Program

A full-stack affiliate management system for running an affiliate program — affiliates sign up, get referral links for products, track clicks/conversions, and receive payouts. Admins manage affiliates, approve applications, and configure the program.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 3000)
- `pnpm --filter @workspace/affiliate-dashboard run dev` — run the frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (requires TTY — run in shell, not CI)
- Required env: `DATABASE_URL`, `SESSION_SECRET` (both auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, port 3000
- Frontend: React 19 + Vite, port 5000 (proxies `/api` to port 3000)
- DB: PostgreSQL + Drizzle ORM
- Auth: express-session + bcryptjs (self-contained, no external provider)
- Email: configurable via admin Settings UI — defaults to console logging in dev; supports Resend or SMTP
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild

## Where things live

- `artifacts/api-server/src/routes/` — all API routes (auth in `portal.ts`, admin in others)
- `artifacts/api-server/src/lib/email.ts` — email sending (console/SMTP/Resend)
- `artifacts/affiliate-dashboard/src/` — React frontend
- `lib/db/src/schema/` — Drizzle schema (one file per table)
- `lib/api-spec/openapi.yaml` — source-of-truth API contract

## Architecture decisions

- Frontend proxies `/api/*` to the API server via Vite dev server proxy — no CORS config needed in dev
- Email provider is configurable at runtime via the admin Settings page (stored in `system_config` table), not hardcoded env vars
- `drizzle-kit push` requires an interactive TTY — cannot be run from CI/non-interactive shells; use `executeSql` directly or run in shell
- Session cookie uses `httpOnly`, `sameSite: lax`, 30-day maxAge; stored in PostgreSQL `session` table via connect-pg-simple

## Product

- **Admin dashboard** (`/`): Manage affiliates, products, conversions, payouts, events, and program settings
- **Affiliate portal** (`/portal`): Self-service dashboard for affiliates — get referral links, track earnings, complete onboarding
- **Tracking endpoint** (`/api/track`): Records referral clicks and redirects to product landing pages

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `drizzle-kit push` needs a TTY — run in the shell tab, not via `pnpm run push` from agent bash
- The `system_config` table must have exactly one row (seeded on first run); the app will fail if it's empty
- PORT env var is required for both the API server and frontend — set in the workflow command

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

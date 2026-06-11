---
name: Lead Commission Engine
description: How lead-based commissions are triggered, stored, and deduplicated
---

## Rule
Commission triggers for leads live in `offer_commission_rules` table (one row per offer+triggerEvent pair — unique index enforced). The engine fires inside the leads route on status changes and inside public.ts on creation.

## Trigger events and when they fire
- `lead_submitted` — fires on POST /leads and POST /public/leads (creation)
- `lead_approved` — fires on PATCH /leads/:id when status becomes "approved"
- `deal_won` — fires on PATCH /leads/:id when status becomes "won"

## Deduplication
`paymentId = "lead-${leadId}-${triggerEvent}"` — checked before insert; if exists, skips silently.

## Conversion record shape
- `userId = "lead-${leadId}"` (synthetic, not a real user)
- `source = "lead_trigger"` — used in stats to filter lead revenue
- `conversionType = triggerEvent` string
- `amount = commissionValue` (the rule's flat value; no sale amount for leads)

## Lead history (audit trail)
Every status change logs to `lead_history` table via `logLeadHistory()` in the leads route. changedBy = "admin" for admin PATCH, "api-key" for public API creation.

## PortalLead type in portal.tsx
Must include all 7 statuses: `"new" | "contacted" | "interested" | "approved" | "won" | "lost" | "rejected"` — mismatch causes TS2367 comparison errors.

**Why:** The pgEnum was altered via raw SQL (ADD VALUE) so Drizzle schema and TypeScript types must be updated manually to match.

**How to apply:** When adding new lead statuses, update: 1) leads.ts schema pgEnum array, 2) leads route VALID_STATUSES, 3) leads.tsx STATUSES const, 4) portal.tsx PortalLead type, 5) LEAD_STATUS_META in portal.tsx.

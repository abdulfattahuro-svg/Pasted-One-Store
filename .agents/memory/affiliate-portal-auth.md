---
name: Affiliate portal auth flow
description: How login/signup/verify flows handle pending_approval and onboarding routing
---

## Rule
Login returns HTTP 200 with affiliate data (via `safeAffiliate()`) for `pending_approval` status AND sets session. The Portal root component (not AuthForm) is responsible for routing based on `signupStatus` and `onboardingSubmitted`.

## How to apply
- `POST /portal/login` — if `pending_approval`, set `req.session.affiliateId` and return `res.json(safeAffiliate(affiliate))` (200, not 403)
- `POST /portal/verify-email` — if `newStatus === "active" || "pending_approval"`, set session
- `POST /portal/signup` (auto-verify) — if `newStatus === "active" || "pending_approval"`, set session and return `{ ..., affiliate: safeAffiliate(...) }`
- `safeAffiliate()` includes `onboardingSubmitted: !!row.onboardingSubmittedAt` in return value
- Portal root: checks `affiliate.signupStatus === "pending_approval"` → shows `OnboardingQuestionsScreen` (if `!onboardingSubmitted`) or `PendingApprovalScreen` (if submitted)
- Portal root: checks `signupStatus === "rejected"` → shows rejection screen

**Why:** Setting session for pending_approval lets the `POST /portal/onboarding` endpoint identify the submitting affiliate without any separate token mechanism. The Portal root is the single source of truth for what screen to show based on affiliate state.

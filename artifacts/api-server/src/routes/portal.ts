import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { db, affiliatesTable, passwordResetTokensTable, systemConfigTable, onboardingResponsesTable } from "@workspace/db";
import { generateRefCode } from "../lib/utils";
import { sendEmail, verificationEmailHtml, approvalEmailHtml, resetEmailHtml } from "../lib/email";
import { getTemplate, renderTemplate, seedEmailTemplates } from "./email_templates";

const router = Router();

function safeAffiliate(row: typeof affiliatesTable.$inferSelect) {
  const { passwordHash: _ph, verificationToken: _vt, ...safe } = row;
  return {
    ...safe,
    createdAt: row.createdAt.toISOString(),
    verificationTokenExpiry: row.verificationTokenExpiry?.toISOString() ?? null,
    welcomedAt: row.welcomedAt?.toISOString() ?? null,
    onboardingSubmittedAt: row.onboardingSubmittedAt?.toISOString() ?? null,
    onboardingSubmitted: !!row.onboardingSubmittedAt,
  };
}

async function getConfig() {
  const [c] = await db.select().from(systemConfigTable);
  return c;
}

// ──────────────────────────────────────────────
// OPEN SIGNUP (self-registration)
// ──────────────────────────────────────────────
router.post("/portal/signup", async (req, res) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const normalEmail = email.toLowerCase().trim();

  const [existing] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, normalEmail));
  if (existing) {
    if (!existing.isSelfSignup && !existing.passwordHash) {
      return res.status(409).json({
        error: "An admin has already created an account for this email. Use the 'Admin Invite' tab to set up your password.",
        code: "USE_SETUP_ACCOUNT",
      });
    }
    if (existing.passwordHash) {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }
  }

  const config = await getConfig();
  const approvalMode = config?.approvalMode ?? "auto";
  const emailProvider = config?.emailProvider ?? "console";

  const hash = await bcrypt.hash(password, 12);
  const refCode = generateRefCode(name);

  // If no email server configured (console mode), skip verification and auto-activate
  const skipVerification = emailProvider === "console";

  let newStatus: "pending_verification" | "pending_approval" | "active";
  let verificationToken: string | null = null;
  let verificationTokenExpiry: Date | null = null;

  if (skipVerification) {
    newStatus = approvalMode === "auto" ? "active" : "pending_approval";
  } else {
    newStatus = "pending_verification";
    verificationToken = crypto.randomBytes(32).toString("hex");
    verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  const [affiliate] = await db.insert(affiliatesTable).values({
    name: name.trim(),
    email: normalEmail,
    refCode,
    passwordHash: hash,
    isSelfSignup: true,
    signupStatus: newStatus,
    verificationToken,
    verificationTokenExpiry,
  }).returning();

  if (!skipVerification && verificationToken) {
    const origin = req.headers.origin ?? `https://${req.headers.host}`;
    const verifyLink = `${origin}/portal?verify=${verificationToken}`;
    await sendEmail({
      to: affiliate.email,
      subject: `Verify your email — ${config?.programName ?? "Affiliate Program"}`,
      html: verificationEmailHtml(affiliate.name, verifyLink, config?.programName ?? undefined),
    });
    return res.status(201).json({ ok: true, status: "pending_verification", email: affiliate.email });
  }

  // Auto-verified: set session for active and pending_approval so onboarding can be submitted
  if (newStatus === "active" || newStatus === "pending_approval") {
    req.session.affiliateId = affiliate.id;
    return res.status(201).json({ ok: true, status: newStatus, autoVerified: true, affiliate: safeAffiliate(affiliate) });
  }

  return res.status(201).json({ ok: true, status: newStatus, email: affiliate.email, autoVerified: true });
});

// ──────────────────────────────────────────────
// EMAIL VERIFICATION
// ──────────────────────────────────────────────
router.post("/portal/verify-email", async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "Token required" });

  const now = new Date();
  const [affiliate] = await db.select().from(affiliatesTable)
    .where(and(eq(affiliatesTable.verificationToken, token), gt(affiliatesTable.verificationTokenExpiry!, now)));

  if (!affiliate) return res.status(400).json({ error: "Verification link is invalid or has expired. Please request a new one." });
  if (affiliate.signupStatus !== "pending_verification") return res.status(400).json({ error: "This link has already been used." });

  const config = await getConfig();
  const approvalMode = config?.approvalMode ?? "auto";
  const newStatus = approvalMode === "auto" ? "active" : "pending_approval";

  await db.update(affiliatesTable).set({
    signupStatus: newStatus,
    verificationToken: null,
    verificationTokenExpiry: null,
  }).where(eq(affiliatesTable.id, affiliate.id));

  if (newStatus === "active" || newStatus === "pending_approval") {
    req.session.affiliateId = affiliate.id;
  }

  return res.json({ ok: true, status: newStatus, approvalMode });
});

// ──────────────────────────────────────────────
// RESEND VERIFICATION
// ──────────────────────────────────────────────
router.post("/portal/resend-verification", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Email required" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate || affiliate.signupStatus !== "pending_verification") {
    return res.json({ ok: true });
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.update(affiliatesTable).set({ verificationToken, verificationTokenExpiry }).where(eq(affiliatesTable.id, affiliate.id));

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const config = await getConfig();
  await sendEmail({
    to: affiliate.email,
    subject: `Verify your email — ${config?.programName ?? "Affiliate Program"}`,
    html: verificationEmailHtml(affiliate.name, `${origin}/portal?verify=${verificationToken}`, config?.programName ?? undefined),
  });

  return res.json({ ok: true });
});

// ──────────────────────────────────────────────
// ADMIN-CREATED ACCOUNT SETUP
// ──────────────────────────────────────────────
router.post("/portal/setup-account", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate) return res.status(404).json({ error: "No affiliate account found for this email. Contact your partner manager." });
  if (affiliate.isSelfSignup) return res.status(400).json({ error: "Please use the sign-in page or 'Join free' tab." });
  if (affiliate.status === "suspended") return res.status(403).json({ error: "This account has been suspended." });
  if (affiliate.passwordHash) return res.status(409).json({ error: "Account already set up. Please log in instead." });

  const hash = await bcrypt.hash(password, 12);
  // Admin-invited affiliates are immediately active (no email verification needed)
  await db.update(affiliatesTable).set({
    passwordHash: hash,
    signupStatus: "active",
  }).where(eq(affiliatesTable.id, affiliate.id));

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate({ ...affiliate, passwordHash: hash, signupStatus: "active" }));
});

// ──────────────────────────────────────────────
// DEMO LOGIN (creates a demo account if needed)
// ──────────────────────────────────────────────
router.post("/portal/demo-login", async (req, res) => {
  const demoEmail = "demo@affiliate.demo";
  const demoPassword = "demo1234";

  let [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, demoEmail));

  if (!affiliate) {
    const hash = await bcrypt.hash(demoPassword, 10);
    const refCode = generateRefCode("Demo User");
    [affiliate] = await db.insert(affiliatesTable).values({
      name: "Demo Affiliate",
      email: demoEmail,
      refCode,
      passwordHash: hash,
      isSelfSignup: true,
      signupStatus: "active",
      status: "active",
    }).returning();
  } else if (affiliate.signupStatus !== "active") {
    await db.update(affiliatesTable).set({ signupStatus: "active", status: "active" }).where(eq(affiliatesTable.id, affiliate.id));
    affiliate = { ...affiliate, signupStatus: "active", status: "active" };
  }

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

// ──────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────
router.post("/portal/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate || !affiliate.passwordHash) return res.status(401).json({ error: "Invalid email or password" });
  if (affiliate.status === "suspended") return res.status(403).json({ error: "This account has been suspended." });

  if (affiliate.isSelfSignup) {
    if (affiliate.signupStatus === "pending_verification") {
      return res.status(403).json({ error: "Please verify your email before signing in.", code: "PENDING_VERIFICATION", email: affiliate.email });
    }
    if (affiliate.signupStatus === "pending_approval") {
      req.session.affiliateId = affiliate.id;
      return res.json(safeAffiliate(affiliate));
    }
    if (affiliate.signupStatus === "rejected") {
      return res.status(403).json({ error: "Your application was not approved. Contact us for more information.", code: "REJECTED" });
    }
  }

  const valid = await bcrypt.compare(password, affiliate.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

// ──────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────
router.post("/portal/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// ME
// ──────────────────────────────────────────────
router.get("/portal/me", async (req, res) => {
  const affiliateId = req.session?.affiliateId;
  if (!affiliateId) return res.status(401).json({ error: "Not authenticated" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId));
  if (!affiliate) return res.status(401).json({ error: "Not authenticated" });

  return res.json(safeAffiliate(affiliate));
});

// ──────────────────────────────────────────────
// MARK WELCOMED
// ──────────────────────────────────────────────
router.post("/portal/mark-welcomed", async (req, res) => {
  const affiliateId = req.session?.affiliateId;
  if (!affiliateId) return res.status(401).json({ error: "Not authenticated" });
  await db.update(affiliatesTable).set({ welcomedAt: new Date() }).where(eq(affiliatesTable.id, affiliateId));
  return res.json({ ok: true });
});

// ──────────────────────────────────────────────
// FORGOT PASSWORD
// ──────────────────────────────────────────────
router.post("/portal/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Email is required" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate || !affiliate.passwordHash) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(passwordResetTokensTable).values({ affiliateId: affiliate.id, token, expiresAt });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const config = await getConfig();
  await sendEmail({
    to: affiliate.email,
    subject: `Reset your password — ${config?.programName ?? "Affiliate Program"}`,
    html: resetEmailHtml(affiliate.name, `${origin}/portal?reset=${token}`, config?.programName ?? undefined),
  });

  return res.json({ ok: true });
});

// ──────────────────────────────────────────────
// RESET PASSWORD
// ──────────────────────────────────────────────
router.post("/portal/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const now = new Date();
  const [resetToken] = await db.select().from(passwordResetTokensTable)
    .where(and(eq(passwordResetTokensTable.token, token), gt(passwordResetTokensTable.expiresAt, now)));

  if (!resetToken || resetToken.usedAt) return res.status(400).json({ error: "Reset link is invalid or has expired. Please request a new one." });

  const hash = await bcrypt.hash(password, 12);
  await db.update(affiliatesTable).set({ passwordHash: hash }).where(eq(affiliatesTable.id, resetToken.affiliateId));
  await db.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, resetToken.id));

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, resetToken.affiliateId));
  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

// ──────────────────────────────────────────────
// ADMIN: list pending affiliates
// ──────────────────────────────────────────────
router.get("/portal/pending-affiliates", async (_req, res) => {
  const rows = await db.select().from(affiliatesTable)
    .where(eq(affiliatesTable.signupStatus, "pending_approval"));
  return res.json(rows.map(r => safeAffiliate(r)));
});

// ──────────────────────────────────────────────
// ADMIN: approve affiliate
// ──────────────────────────────────────────────
router.post("/portal/approve-affiliate/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [affiliate] = await db.update(affiliatesTable)
    .set({ signupStatus: "active", status: "active" })
    .where(eq(affiliatesTable.id, id))
    .returning();

  if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const config = await getConfig();
  const tpl = await getTemplate("approval");
  if (tpl) {
    const { subject, body } = renderTemplate(tpl, {
      name: affiliate.name,
      programName: config?.programName ?? "Affiliate Program",
      link: `${origin}/portal`,
    });
    await sendEmail({ to: affiliate.email, subject, html: body });
  } else {
    await sendEmail({
      to: affiliate.email,
      subject: `You're approved! — ${config?.programName ?? "Affiliate Program"}`,
      html: approvalEmailHtml(affiliate.name, `${origin}/portal`, config?.programName ?? undefined),
    });
  }

  return res.json(safeAffiliate(affiliate));
});

// ──────────────────────────────────────────────
// ADMIN: reject affiliate
// ──────────────────────────────────────────────
router.post("/portal/reject-affiliate/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [affiliate] = await db.update(affiliatesTable)
    .set({ signupStatus: "rejected" })
    .where(eq(affiliatesTable.id, id))
    .returning();

  if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });

  const config = await getConfig();
  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const tpl = await getTemplate("rejection");
  if (tpl) {
    const { subject, body } = renderTemplate(tpl, {
      name: affiliate.name,
      programName: config?.programName ?? "Affiliate Program",
      link: `${origin}/portal`,
    });
    await sendEmail({ to: affiliate.email, subject, html: body });
  }

  return res.json(safeAffiliate(affiliate));
});

// ──────────────────────────────────────────────
// AFFILIATE: submit onboarding questions
// ──────────────────────────────────────────────
const ONBOARDING_QUESTIONS = [
  { key: "inspiration", question: "What inspired you to join our affiliate program?" },
  { key: "about_you", question: "Tell us about yourself — who are you and what do you do?" },
  { key: "promotion", question: "How do you plan to share your referral links? (e.g. WhatsApp, Instagram, YouTube, blog)" },
  { key: "belief", question: "Why do you believe in the products you'll be promoting?" },
  { key: "meaning", question: "What would earning your first commission mean to you?" },
];

router.post("/portal/onboarding", async (req, res) => {
  const affiliateId = req.session?.affiliateId;
  if (!affiliateId) return res.status(401).json({ error: "Not authenticated" });

  const answers = req.body as Record<string, string>;

  // Clear existing responses for idempotency
  await db.delete(onboardingResponsesTable).where(eq(onboardingResponsesTable.affiliateId, affiliateId));

  for (const q of ONBOARDING_QUESTIONS) {
    const answer = (answers[q.key] ?? "").trim();
    if (answer) {
      await db.insert(onboardingResponsesTable).values({
        affiliateId,
        questionKey: q.key,
        question: q.question,
        answer,
      });
    }
  }

  await db.update(affiliatesTable)
    .set({ onboardingSubmittedAt: new Date() })
    .where(eq(affiliatesTable.id, affiliateId));

  return res.json({ ok: true });
});

// Public (no session) onboarding submit via email token
router.post("/portal/onboarding-by-token", async (req, res) => {
  const { affiliateId, answers } = req.body as { affiliateId?: number; answers?: Record<string, string> };
  if (!affiliateId || !answers) return res.status(400).json({ error: "affiliateId and answers required" });

  // Set session for this affiliate so they're "logged in" after submission
  req.session.affiliateId = affiliateId;

  await db.delete(onboardingResponsesTable).where(eq(onboardingResponsesTable.affiliateId, affiliateId));
  for (const q of ONBOARDING_QUESTIONS) {
    const answer = (answers[q.key] ?? "").trim();
    if (answer) {
      await db.insert(onboardingResponsesTable).values({
        affiliateId,
        questionKey: q.key,
        question: q.question,
        answer,
      });
    }
  }

  await db.update(affiliatesTable)
    .set({ onboardingSubmittedAt: new Date() })
    .where(eq(affiliatesTable.id, affiliateId));

  return res.json({ ok: true });
});

// ──────────────────────────────────────────────
// ADMIN: get onboarding answers for one affiliate
// ──────────────────────────────────────────────
router.get("/portal/affiliate-onboarding/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(onboardingResponsesTable).where(eq(onboardingResponsesTable.affiliateId, id));
  return res.json(rows);
});

// ──────────────────────────────────────────────
// PORTAL CONFIG (public program info for portal)
// ──────────────────────────────────────────────
router.get("/portal/program-info", async (_req, res) => {
  const config = await getConfig();
  return res.json({
    programName: config?.programName ?? "Affiliate Program",
    programTagline: config?.programTagline ?? "Earn real money sharing apps you believe in.",
    commissionHighlight: config?.commissionHighlight ?? "Earn up to $500 per referral",
    programDetails: config?.programDetails ?? "",
    approvalMode: config?.approvalMode ?? "auto",
    emailProvider: config?.emailProvider ?? "console",
  });
});

export default router;

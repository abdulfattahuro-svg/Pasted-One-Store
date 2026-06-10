import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";
import { db, affiliatesTable, passwordResetTokensTable } from "@workspace/db";

const router = Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function safeAffiliate(row: typeof affiliatesTable.$inferSelect) {
  const { passwordHash: _ph, ...safe } = row;
  return { ...safe, createdAt: row.createdAt.toISOString() };
}

async function sendResetEmail(email: string, name: string, resetLink: string) {
  if (!resend) {
    console.log(`[RESET EMAIL - DEV] To: ${email} | Link: ${resetLink}`);
    return;
  }
  await resend.emails.send({
    from: "OneStore Affiliate <noreply@onestore.app>",
    to: email,
    subject: "Reset your affiliate portal password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#111;margin-bottom:8px">Reset your password</h2>
        <p style="color:#555;margin-bottom:24px">Hi ${name}, click the button below to reset your affiliate portal password. This link expires in 1 hour.</p>
        <a href="${resetLink}" style="display:inline-block;background:#3cb371;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Reset password</a>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, you can ignore this email. Your password won't change.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#bbb;font-size:11px">OneStore Affiliate Network</p>
      </div>
    `,
  });
}

router.post("/portal/signup", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate) return res.status(404).json({ error: "No affiliate account found for this email. Contact your partner manager." });
  if (affiliate.status === "suspended") return res.status(403).json({ error: "This account has been suspended." });
  if (affiliate.passwordHash) return res.status(409).json({ error: "Account already set up. Please log in instead." });

  const hash = await bcrypt.hash(password, 12);
  await db.update(affiliatesTable).set({ passwordHash: hash }).where(eq(affiliatesTable.id, affiliate.id));

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

router.post("/portal/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate || !affiliate.passwordHash) return res.status(401).json({ error: "Invalid email or password" });
  if (affiliate.status === "suspended") return res.status(403).json({ error: "This account has been suspended." });

  const valid = await bcrypt.compare(password, affiliate.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

router.post("/portal/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get("/portal/me", async (req, res) => {
  const affiliateId = req.session?.affiliateId;
  if (!affiliateId) return res.status(401).json({ error: "Not authenticated" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId));
  if (!affiliate) return res.status(401).json({ error: "Not authenticated" });

  return res.json(safeAffiliate(affiliate));
});

router.post("/portal/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Email is required" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));

  if (!affiliate || !affiliate.passwordHash) {
    return res.json({ ok: true, message: "If an account exists, a reset link has been sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(passwordResetTokensTable).values({
    affiliateId: affiliate.id,
    token,
    expiresAt,
  });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const resetLink = `${origin}/portal?reset=${token}`;

  await sendResetEmail(affiliate.email, affiliate.name, resetLink);

  return res.json({ ok: true, message: "If an account exists, a reset link has been sent." });
});

router.post("/portal/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const now = new Date();
  const [resetToken] = await db.select().from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.token, token),
      gt(passwordResetTokensTable.expiresAt, now),
    ));

  if (!resetToken || resetToken.usedAt) {
    return res.status(400).json({ error: "Reset link is invalid or has expired. Please request a new one." });
  }

  const hash = await bcrypt.hash(password, 12);
  await db.update(affiliatesTable).set({ passwordHash: hash }).where(eq(affiliatesTable.id, resetToken.affiliateId));
  await db.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, resetToken.id));

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, resetToken.affiliateId));
  req.session.affiliateId = affiliate.id;

  return res.json(safeAffiliate(affiliate));
});

export default router;

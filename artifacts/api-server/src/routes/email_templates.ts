import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, emailTemplatesTable } from "@workspace/db";

const router = Router();

const DEFAULT_TEMPLATES = [
  {
    name: "verification",
    subject: "Verify your email — {{programName}}",
    body: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#16a34a">Verify your email address</h2>
  <p>Hi {{name}},</p>
  <p>Thanks for signing up for <strong>{{programName}}</strong>. Click the button below to verify your email and complete your registration.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="{{link}}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Verify Email</a>
  </p>
  <p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>
</div>`,
  },
  {
    name: "approval",
    subject: "You're approved! Welcome to {{programName}}",
    body: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#16a34a">🎉 You're in!</h2>
  <p>Hi {{name}},</p>
  <p>Great news — your application to <strong>{{programName}}</strong> has been approved! You can now log in and start sharing your referral link to earn commissions.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="{{link}}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Go to my dashboard</a>
  </p>
  <p style="color:#666;font-size:13px">Questions? Just reply to this email — we're happy to help.</p>
</div>`,
  },
  {
    name: "rejection",
    subject: "Update on your {{programName}} application",
    body: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2>Application update</h2>
  <p>Hi {{name}},</p>
  <p>Thank you for your interest in <strong>{{programName}}</strong>. After reviewing your application, we're unable to approve it at this time.</p>
  <p>If you believe this is a mistake or would like to discuss further, please reply to this email.</p>
  <p style="color:#666;font-size:13px">We appreciate your interest and wish you all the best.</p>
</div>`,
  },
  {
    name: "password_reset",
    subject: "Reset your password — {{programName}}",
    body: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2>Reset your password</h2>
  <p>Hi {{name}},</p>
  <p>We received a request to reset your password for <strong>{{programName}}</strong>. Click the button below to choose a new one.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="{{link}}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Reset Password</a>
  </p>
  <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
</div>`,
  },
];

export async function seedEmailTemplates() {
  for (const tpl of DEFAULT_TEMPLATES) {
    const [existing] = await db.select({ name: emailTemplatesTable.name }).from(emailTemplatesTable).where(eq(emailTemplatesTable.name, tpl.name));
    if (!existing) {
      await db.insert(emailTemplatesTable).values(tpl).catch(() => {});
    }
  }
}

export async function getTemplate(name: string): Promise<{ subject: string; body: string } | null> {
  const [row] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.name, name));
  if (row) return { subject: row.subject, body: row.body };
  const fallback = DEFAULT_TEMPLATES.find(t => t.name === name);
  return fallback ?? null;
}

export function renderTemplate(template: { subject: string; body: string }, vars: Record<string, string>) {
  let subject = template.subject;
  let body = template.body;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, "g");
    subject = subject.replace(re, v);
    body = body.replace(re, v);
  }
  return { subject, body };
}

router.get("/email-templates", async (_req, res) => {
  const rows = await db.select().from(emailTemplatesTable);
  if (rows.length === 0) {
    await seedEmailTemplates();
    const fresh = await db.select().from(emailTemplatesTable);
    return res.json(fresh);
  }
  return res.json(rows);
});

router.patch("/email-templates/:name", async (req, res) => {
  const { name } = req.params;
  const { subject, body } = req.body as { subject?: string; body?: string };
  if (!subject || !body) return res.status(400).json({ error: "subject and body required" });

  const [existing] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.name, name));
  if (existing) {
    const [updated] = await db.update(emailTemplatesTable)
      .set({ subject, body, updatedAt: new Date() })
      .where(eq(emailTemplatesTable.name, name))
      .returning();
    return res.json(updated);
  } else {
    const [created] = await db.insert(emailTemplatesTable).values({ name, subject, body }).returning();
    return res.json(created);
  }
});

export default router;

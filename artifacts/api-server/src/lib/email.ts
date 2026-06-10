import nodemailer from "nodemailer";
import { Resend } from "resend";
import { db, systemConfigTable } from "@workspace/db";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function getEmailConfig() {
  const [config] = await db.select().from(systemConfigTable);
  return config;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const config = await getEmailConfig();
  const provider = config?.emailProvider ?? "console";

  if (provider === "smtp" && config?.smtpHost && config?.smtpUser) {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: (config.smtpPort ?? 587) === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass ?? "" },
    });
    await transporter.sendMail({
      from: config.smtpFrom ?? config.smtpUser,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return;
  }

  // Try Resend: config table first, then env var
  const resendKey = config?.resendApiKey || process.env.RESEND_API_KEY;
  if (provider === "resend" && resendKey) {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: config?.smtpFrom ?? "OneStore Affiliate <noreply@onestore.app>",
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return;
  }

  // Console fallback (dev mode)
  console.log(`[EMAIL - DEV] To: ${payload.to} | Subject: ${payload.subject}`);
  console.log(`[EMAIL - DEV] Preview: ${payload.html.replace(/<[^>]+>/g, "").slice(0, 300)}`);
}

export function verificationEmailHtml(name: string, verifyLink: string, programName = "Affiliate Program") {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px">
      <div style="margin-bottom:24px">
        <h1 style="color:#3cb371;font-size:22px;margin:0 0 4px">Verify your email</h1>
        <p style="color:#888;margin:0;font-size:13px">${programName}</p>
      </div>
      <p style="color:#ccc;font-size:14px;line-height:1.6">Hi <strong style="color:#fff">${name}</strong>, thanks for signing up! Click the button below to verify your email address and complete your registration.</p>
      <div style="margin:28px 0">
        <a href="${verifyLink}" style="display:inline-block;background:#3cb371;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Verify my email</a>
      </div>
      <p style="color:#666;font-size:12px">This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0"/>
      <p style="color:#555;font-size:11px">${programName} · Sent to ${name}</p>
    </div>
  `;
}

export function approvalEmailHtml(name: string, portalLink: string, programName = "Affiliate Program") {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px">
      <div style="margin-bottom:24px">
        <h1 style="color:#3cb371;font-size:22px;margin:0 0 4px">🎉 You're approved!</h1>
        <p style="color:#888;margin:0;font-size:13px">${programName}</p>
      </div>
      <p style="color:#ccc;font-size:14px;line-height:1.6">Hi <strong style="color:#fff">${name}</strong>, great news — your affiliate account has been approved! You can now log in to your dashboard, get your referral links, and start earning.</p>
      <div style="margin:28px 0">
        <a href="${portalLink}" style="display:inline-block;background:#3cb371;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Go to my dashboard →</a>
      </div>
      <p style="color:#666;font-size:12px">Welcome to the team. We're excited to have you on board!</p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0"/>
      <p style="color:#555;font-size:11px">${programName}</p>
    </div>
  `;
}

export function resetEmailHtml(name: string, resetLink: string, programName = "Affiliate Program") {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px">
      <h2 style="color:#fff;margin-bottom:8px">Reset your password</h2>
      <p style="color:#ccc;font-size:14px;line-height:1.6">Hi <strong>${name}</strong>, click below to reset your password. This link expires in 1 hour.</p>
      <div style="margin:28px 0">
        <a href="${resetLink}" style="display:inline-block;background:#3cb371;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Reset password</a>
      </div>
      <p style="color:#666;font-size:12px">If you didn't request this, you can ignore this email.</p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0"/>
      <p style="color:#555;font-size:11px">${programName}</p>
    </div>
  `;
}

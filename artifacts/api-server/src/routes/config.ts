import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, systemConfigTable } from "@workspace/db";
import { UpdateConfigBody } from "@workspace/api-zod";

const router = Router();

function formatConfig(c: typeof systemConfigTable.$inferSelect) {
  return {
    ...c,
    commissionValue: Number(c.commissionValue),
  };
}

router.get("/config", async (req, res) => {
  const [config] = await db.select().from(systemConfigTable);
  if (!config) return res.status(404).json({ error: "Config not found" });
  return res.json(formatConfig(config));
});

router.patch("/config", async (req, res) => {
  const body = UpdateConfigBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const [existing] = await db.select().from(systemConfigTable);
  if (!existing) return res.status(404).json({ error: "Config not found" });

  const updates: Partial<typeof systemConfigTable.$inferInsert> = {};
  if (body.data.commissionType) updates.commissionType = body.data.commissionType;
  if (body.data.commissionValue !== undefined) updates.commissionValue = String(body.data.commissionValue);
  if (body.data.holdDays !== undefined) updates.holdDays = body.data.holdDays;
  if (body.data.currency) updates.currency = body.data.currency;

  // Extended fields (passed through as raw body extras)
  const raw = req.body as Record<string, unknown>;
  if (typeof raw.approvalMode === "string") updates.approvalMode = raw.approvalMode;
  if (typeof raw.emailProvider === "string") updates.emailProvider = raw.emailProvider;
  if (typeof raw.smtpHost === "string") updates.smtpHost = raw.smtpHost || null;
  if (raw.smtpPort !== undefined) updates.smtpPort = Number(raw.smtpPort) || 587;
  if (typeof raw.smtpUser === "string") updates.smtpUser = raw.smtpUser || null;
  if (typeof raw.smtpPass === "string") updates.smtpPass = raw.smtpPass || null;
  if (typeof raw.smtpFrom === "string") updates.smtpFrom = raw.smtpFrom || null;
  if (typeof raw.resendApiKey === "string") updates.resendApiKey = raw.resendApiKey || null;
  if (typeof raw.programName === "string") updates.programName = raw.programName || null;
  if (typeof raw.programTagline === "string") updates.programTagline = raw.programTagline || null;
  if (typeof raw.commissionHighlight === "string") updates.commissionHighlight = raw.commissionHighlight || null;
  if (typeof raw.programDetails === "string") updates.programDetails = raw.programDetails || null;

  const [row] = await db.update(systemConfigTable)
    .set(updates)
    .where(eq(systemConfigTable.id, existing.id))
    .returning();

  return res.json(formatConfig(row));
});

export default router;

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

  const [row] = await db.update(systemConfigTable)
    .set(updates)
    .where(eq(systemConfigTable.id, existing.id))
    .returning();

  return res.json(formatConfig(row));
});

export default router;

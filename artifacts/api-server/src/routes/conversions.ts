import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, affiliatesTable, conversionsTable, referralEventsTable, systemConfigTable } from "@workspace/db";
import {
  ListConversionsQueryParams,
  CreateConversionBody,
  GetConversionParams,
} from "@workspace/api-zod";

const router = Router();

function formatConversion(c: typeof conversionsTable.$inferSelect) {
  return {
    ...c,
    amount: Number(c.amount),
    commission: Number(c.commission),
    conversionDate: c.conversionDate.toISOString(),
    holdEndDate: c.holdEndDate.toISOString(),
  };
}

router.get("/conversions", async (req, res) => {
  const query = ListConversionsQueryParams.safeParse({
    ...req.query,
    affiliateId: req.query.affiliateId ? Number(req.query.affiliateId) : undefined,
  });
  if (!query.success) return res.status(400).json({ error: "Invalid query params" });

  const { affiliateId, status, appName } = query.data;

  let rows = await db.select().from(conversionsTable);

  if (affiliateId) rows = rows.filter(r => r.affiliateId === affiliateId);
  if (status) rows = rows.filter(r => r.status === status);
  if (appName) rows = rows.filter(r => r.appName === appName);

  rows = rows.sort((a, b) => b.conversionDate.getTime() - a.conversionDate.getTime());

  return res.json(rows.map(formatConversion));
});

router.post("/conversions", async (req, res) => {
  const body = CreateConversionBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  // Verify payment_id uniqueness
  const existing = await db.select().from(conversionsTable)
    .where(eq(conversionsTable.paymentId, body.data.paymentId));
  if (existing.length > 0) {
    return res.status(409).json({ error: "Duplicate payment_id" });
  }

  // Find affiliate via first-touch signup
  const signupEvent = await db.select()
    .from(referralEventsTable)
    .where(eq(referralEventsTable.userId, body.data.userId));

  const firstSignup = signupEvent
    .filter(e => e.eventType === "signup")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  if (!firstSignup) {
    return res.status(400).json({ error: "No referral found for this user" });
  }

  // Get config for commission calculation
  const [config] = await db.select().from(systemConfigTable);
  if (!config) {
    return res.status(500).json({ error: "System config not initialized" });
  }

  const commissionValue = Number(config.commissionValue);
  const commission = config.commissionType === "fixed"
    ? commissionValue
    : (body.data.amount * commissionValue) / 100;

  const holdEndDate = new Date();
  holdEndDate.setDate(holdEndDate.getDate() + config.holdDays);

  const [row] = await db.insert(conversionsTable).values({
    affiliateId: firstSignup.affiliateId,
    userId: body.data.userId,
    appName: body.data.appName,
    paymentId: body.data.paymentId,
    amount: String(body.data.amount),
    commission: String(commission),
    status: "HOLD",
    holdEndDate,
  }).returning();

  return res.status(201).json(formatConversion(row));
});

router.get("/conversions/:id", async (req, res) => {
  const params = GetConversionParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db.select().from(conversionsTable)
    .where(eq(conversionsTable.id, params.data.id));

  if (!row) return res.status(404).json({ error: "Conversion not found" });

  return res.json(formatConversion(row));
});

export default router;

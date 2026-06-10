import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, affiliatesTable, referralEventsTable } from "@workspace/db";
import {
  TrackClickBody,
  TrackSignupBody,
  ListEventsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.post("/events/click", async (req, res) => {
  const body = TrackClickBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const [affiliate] = await db.select()
    .from(affiliatesTable)
    .where(eq(affiliatesTable.refCode, body.data.refCode));

  if (!affiliate) return res.status(404).json({ error: "Invalid ref_code" });
  if (affiliate.status !== "active") return res.status(400).json({ error: "Affiliate suspended" });

  const ip = body.data.ip === "auto"
    ? (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || null
    : body.data.ip;

  const [event] = await db.insert(referralEventsTable).values({
    affiliateId: affiliate.id,
    refCode: body.data.refCode,
    appName: body.data.appName,
    eventType: "click",
    ipAddress: ip,
  }).returning();

  return res.status(201).json({ success: true, message: "Click tracked", eventId: event.id });
});

router.post("/events/signup", async (req, res) => {
  const body = TrackSignupBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const [affiliate] = await db.select()
    .from(affiliatesTable)
    .where(eq(affiliatesTable.refCode, body.data.refCode));

  if (!affiliate) return res.status(404).json({ error: "Invalid ref_code" });

  // First-touch attribution: check if user already attributed
  const existing = await db.select()
    .from(referralEventsTable)
    .where(
      and(
        eq(referralEventsTable.userId, body.data.userId),
        eq(referralEventsTable.eventType, "signup")
      )
    );

  if (existing.length > 0) {
    return res.status(200).json({ success: true, message: "Already attributed, duplicate ignored", eventId: null });
  }

  const [event] = await db.insert(referralEventsTable).values({
    affiliateId: affiliate.id,
    refCode: body.data.refCode,
    appName: body.data.appName,
    eventType: "signup",
    userId: body.data.userId,
  }).returning();

  return res.status(201).json({ success: true, message: "Signup attributed", eventId: event.id });
});

router.get("/events", async (req, res) => {
  const query = ListEventsQueryParams.safeParse({
    ...req.query,
    affiliateId: req.query.affiliateId ? Number(req.query.affiliateId) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  if (!query.success) return res.status(400).json({ error: "Invalid query params" });

  const { affiliateId, appName, eventType, limit } = query.data;

  let rows = await db.select().from(referralEventsTable);

  if (affiliateId) rows = rows.filter(r => r.affiliateId === affiliateId);
  if (appName) rows = rows.filter(r => r.appName === appName);
  if (eventType) rows = rows.filter(r => r.eventType === eventType);

  rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit ?? 50);

  return res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;

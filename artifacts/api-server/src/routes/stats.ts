import { Router } from "express";
import { and, lte, eq } from "drizzle-orm";
import { db, affiliatesTable, referralEventsTable, conversionsTable, payoutsTable, productsTable } from "@workspace/db";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  const affiliates = await db.select().from(affiliatesTable);
  const events = await db.select().from(referralEventsTable);
  const conversions = await db.select().from(conversionsTable);
  const payouts = await db.select().from(payoutsTable);

  const holdAmount = conversions.filter(c => c.status === "HOLD").reduce((s, c) => s + Number(c.commission), 0);
  const payableAmount = conversions.filter(c => c.status === "PAYABLE").reduce((s, c) => s + Number(c.commission), 0);
  const paidAmount = conversions.filter(c => c.status === "PAID").reduce((s, c) => s + Number(c.commission), 0);
  const totalRevenue = conversions.reduce((s, c) => s + Number(c.amount), 0);

  return res.json({
    totalAffiliates: affiliates.length,
    activeAffiliates: affiliates.filter(a => a.status === "active").length,
    totalClicks: events.filter(e => e.eventType === "click").length,
    totalSignups: events.filter(e => e.eventType === "signup").length,
    totalConversions: conversions.length,
    holdAmount,
    payableAmount,
    paidAmount,
    totalRevenue,
    pendingPayouts: payouts.filter(p => p.status === "PENDING").length,
  });
});

async function buildProductStats() {
  const events = await db.select().from(referralEventsTable);
  const conversions = await db.select().from(conversionsTable);
  const products = await db.select().from(productsTable);

  return products.map(product => {
    // Match by productSlug (new) or legacy appName (backward compat)
    const productEvents = events.filter(e =>
      e.productSlug === product.slug || e.appName === product.slug
    );
    const productConversions = conversions.filter(c =>
      c.productSlug === product.slug || c.appName === product.slug
    );

    return {
      productId: product.id,
      appName: product.slug,
      productName: product.name,
      productSlug: product.slug,
      category: product.category,
      active: product.active,
      clicks: productEvents.filter(e => e.eventType === "click").length,
      signups: productEvents.filter(e => e.eventType === "signup").length,
      conversions: productConversions.length,
      revenue: productConversions.reduce((s, c) => s + Number(c.amount), 0),
      commission: productConversions.reduce((s, c) => s + Number(c.commission), 0),
    };
  });
}

router.get("/stats/by-app", async (_req, res) => {
  return res.json(await buildProductStats());
});

router.get("/stats/by-product", async (_req, res) => {
  return res.json(await buildProductStats());
});

router.get("/stats/top-affiliates", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const affiliates = await db.select().from(affiliatesTable);
  const events = await db.select().from(referralEventsTable);
  const conversions = await db.select().from(conversionsTable);

  const result = affiliates
    .map(a => ({
      affiliateId: a.id,
      name: a.name,
      email: a.email,
      refCode: a.refCode,
      clicks: events.filter(e => e.affiliateId === a.id && e.eventType === "click").length,
      conversions: conversions.filter(c => c.affiliateId === a.id).length,
      totalEarnings: conversions
        .filter(c => c.affiliateId === a.id)
        .reduce((s, c) => s + Number(c.commission), 0),
    }))
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .slice(0, limit);

  return res.json(result);
});

router.get("/stats/earnings-timeline", async (req, res) => {
  const conversions = await db.select().from(conversionsTable);

  const days: Record<string, { earnings: number; conversions: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days[key] = { earnings: 0, conversions: 0 };
  }

  for (const c of conversions) {
    const key = c.conversionDate.toISOString().slice(0, 10);
    if (days[key]) {
      days[key].earnings += Number(c.commission);
      days[key].conversions += 1;
    }
  }

  return res.json(Object.entries(days).map(([date, v]) => ({ date, ...v })));
});

router.post("/cron/release-holds", async (req, res) => {
  const now = new Date();

  const expired = await db.select().from(conversionsTable)
    .where(
      and(
        eq(conversionsTable.status, "HOLD"),
        lte(conversionsTable.holdEndDate, now)
      )
    );

  if (expired.length > 0) {
    for (const c of expired) {
      await db.update(conversionsTable)
        .set({ status: "PAYABLE" })
        .where(eq(conversionsTable.id, c.id));
    }
  }

  return res.json({
    released: expired.length,
    message: `Released ${expired.length} held conversion(s) to PAYABLE`,
  });
});

export default router;

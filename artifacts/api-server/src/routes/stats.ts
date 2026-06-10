import { Router } from "express";
import { and, lte, eq, gte } from "drizzle-orm";
import { db, affiliatesTable, referralEventsTable, conversionsTable, payoutsTable, productsTable, systemConfigTable } from "@workspace/db";
import { leadsTable } from "@workspace/db";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [affiliates, events, conversions, payouts, leads, leadsThisMonth] = await Promise.all([
    db.select().from(affiliatesTable),
    db.select().from(referralEventsTable),
    db.select().from(conversionsTable),
    db.select().from(payoutsTable),
    db.select().from(leadsTable),
    db.select().from(leadsTable).where(gte(leadsTable.createdAt, startOfMonth)),
  ]);

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
    totalLeads: leads.length,
    leadsThisMonth: leadsThisMonth.length,
  });
});

async function buildProductStats() {
  const events = await db.select().from(referralEventsTable);
  const conversions = await db.select().from(conversionsTable);
  const products = await db.select().from(productsTable);

  return products.map(product => {
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
      excludeFromLeaderboard: product.excludeFromLeaderboard,
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

// ─── AFFILIATE LEADERBOARD ────────────────────────────────────
// Returns anonymized rankings. Pass `ref=REFCODE` to highlight the current affiliate.
// Respects excludeFromLeaderboard on products and the global leaderboard_enabled toggle.
router.get("/stats/leaderboard", async (req, res) => {
  const refCode = (req.query.ref as string | undefined)?.toUpperCase();

  const [config] = await db.select().from(systemConfigTable);
  if (!config?.leaderboardEnabled) {
    return res.json({ enabled: false, entries: [] });
  }

  const products = await db.select().from(productsTable);
  const excludedSlugs = new Set(products.filter(p => p.excludeFromLeaderboard).map(p => p.slug));
  const excludedIds = new Set(
    products.filter(p => p.excludeFromLeaderboard).map(p => p.id)
  );

  const affiliates = await db.select()
    .from(affiliatesTable)
    .where(eq(affiliatesTable.status, "active"));

  const allEvents = await db.select().from(referralEventsTable);
  const allConversions = await db.select().from(conversionsTable);

  // Filter out events/conversions from excluded products
  function isExcluded(productId: number | null, productSlug: string | null, appName: string) {
    if (productId && excludedIds.has(productId)) return true;
    if (productSlug && excludedSlugs.has(productSlug)) return true;
    if (!productId && !productSlug && excludedSlugs.has(appName)) return true;
    return false;
  }

  const filteredEvents = allEvents.filter(e =>
    !isExcluded(e.productId ?? null, e.productSlug ?? null, e.appName)
  );
  const filteredConversions = allConversions.filter(c =>
    !isExcluded(c.productId ?? null, c.productSlug ?? null, c.appName)
  );

  // Score each active affiliate
  const scored = affiliates.map(a => ({
    affiliateId: a.id,
    refCode: a.refCode,
    clicks: filteredEvents.filter(e => e.affiliateId === a.id && e.eventType === "click").length,
    conversions: filteredConversions.filter(c => c.affiliateId === a.id).length,
    commission: filteredConversions
      .filter(c => c.affiliateId === a.id)
      .reduce((s, c) => s + Number(c.commission), 0),
  }));

  // Sort: commission desc → conversions desc → clicks desc
  const ranked = scored.sort(
    (a, b) => b.commission - a.commission || b.conversions - a.conversions || b.clicks - a.clicks
  );

  const entries = ranked.map((entry, i) => ({
    rank: i + 1,
    label: refCode && entry.refCode === refCode ? "You" : "Partner",
    isYou: !!(refCode && entry.refCode === refCode),
    clicks: entry.clicks,
    conversions: entry.conversions,
    commission: entry.commission,
  }));

  // If caller provided a refCode and they're not in the list (shouldn't happen but safety net)
  const excludedProductNames = products
    .filter(p => p.excludeFromLeaderboard)
    .map(p => p.name);

  return res.json({
    enabled: true,
    totalParticipants: entries.length,
    excludedProducts: excludedProductNames,
    entries,
  });
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

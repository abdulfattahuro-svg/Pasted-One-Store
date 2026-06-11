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

  const approvedLeads = leads.filter(l => l.status === "approved" || l.status === "won").length;
  const wonLeads = leads.filter(l => l.status === "won").length;
  const totalLeadsCount = leads.length;
  const leadConversionPct = totalLeadsCount > 0 ? Math.round((wonLeads / totalLeadsCount) * 100) : 0;
  const leadRevenue = conversions
    .filter(c => c.source === "lead_trigger")
    .reduce((s, c) => s + Number(c.commission), 0);

  // Deal value aggregates
  const totalExpectedValue = leads.reduce((s, l) => s + (l.expectedValue ? Number(l.expectedValue) : 0), 0);
  const totalClosedDealValue = leads
    .filter(l => l.status === "won")
    .reduce((s, l) => s + (l.closedDealValue ? Number(l.closedDealValue) : 0), 0);
  const totalActualRevenue = leads.reduce((s, l) => s + (l.actualRevenue ? Number(l.actualRevenue) : 0), 0);
  const leadsWithValue = leads.filter(l => l.expectedValue && Number(l.expectedValue) > 0);
  const avgDealSize = leadsWithValue.length > 0 ? Math.round(totalExpectedValue / leadsWithValue.length) : 0;

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
    totalLeads: totalLeadsCount,
    leadsThisMonth: leadsThisMonth.length,
    approvedLeads,
    wonLeads,
    leadConversionPct,
    leadRevenue,
    totalExpectedValue,
    totalClosedDealValue,
    totalActualRevenue,
    avgDealSize,
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

// ─── LEAD ECONOMICS ───────────────────────────────────────────────────────
router.get("/stats/lead-economics", async (_req, res) => {
  const [leads, leadConversions, affiliates, products] = await Promise.all([
    db.select().from(leadsTable),
    db.select().from(conversionsTable).where(eq(conversionsTable.source, "lead_trigger")),
    db.select({ id: affiliatesTable.id, name: affiliatesTable.name, refCode: affiliatesTable.refCode }).from(affiliatesTable),
    db.select({ id: productsTable.id, name: productsTable.name, slug: productsTable.slug }).from(productsTable),
  ]);

  const wonLeads = leads.filter(l => l.status === "won");

  const totalExpectedValue = leads.reduce((s, l) => s + (l.expectedValue ? Number(l.expectedValue) : 0), 0);
  const totalClosedDealValue = wonLeads.reduce((s, l) => s + (l.closedDealValue ? Number(l.closedDealValue) : 0), 0);
  const totalActualRevenue = leads.reduce((s, l) => s + (l.actualRevenue ? Number(l.actualRevenue) : 0), 0);
  const leadsWithValue = leads.filter(l => l.expectedValue && Number(l.expectedValue) > 0);
  const avgDealSize = leadsWithValue.length > 0 ? Math.round(totalExpectedValue / leadsWithValue.length) : 0;
  const totalLeadCommissions = leadConversions.reduce((s, c) => s + Number(c.commission), 0);

  // Top affiliates by closed deal value + commission
  const affiliateMap = new Map(affiliates.map(a => [a.id, a]));
  const affRevenue: Record<number, { name: string; refCode: string; closedValue: number; commission: number; leads: number }> = {};

  for (const lead of leads) {
    if (!affRevenue[lead.affiliateId]) {
      const aff = affiliateMap.get(lead.affiliateId);
      affRevenue[lead.affiliateId] = { name: aff?.name ?? "—", refCode: aff?.refCode ?? "—", closedValue: 0, commission: 0, leads: 0 };
    }
    affRevenue[lead.affiliateId].leads += 1;
    if (lead.status === "won" && lead.closedDealValue) {
      affRevenue[lead.affiliateId].closedValue += Number(lead.closedDealValue);
    }
  }
  for (const conv of leadConversions) {
    if (!affRevenue[conv.affiliateId]) {
      const aff = affiliateMap.get(conv.affiliateId);
      affRevenue[conv.affiliateId] = { name: aff?.name ?? "—", refCode: aff?.refCode ?? "—", closedValue: 0, commission: 0, leads: 0 };
    }
    affRevenue[conv.affiliateId].commission += Number(conv.commission);
  }
  const topAffiliatesByRevenue = Object.entries(affRevenue)
    .map(([id, v]) => ({ affiliateId: Number(id), ...v }))
    .filter(a => a.leads > 0 || a.commission > 0)
    .sort((a, b) => b.closedValue - a.closedValue || b.commission - a.commission)
    .slice(0, 8);

  // Top offers by closed deal value
  const productMap = new Map(products.map(p => [p.id, p]));
  const offerRevenue: Record<number, { name: string; slug: string; closedValue: number; commission: number; leads: number; wonLeads: number }> = {};

  for (const lead of leads) {
    if (!lead.productId) continue;
    if (!offerRevenue[lead.productId]) {
      const prod = productMap.get(lead.productId);
      offerRevenue[lead.productId] = { name: prod?.name ?? "—", slug: prod?.slug ?? "—", closedValue: 0, commission: 0, leads: 0, wonLeads: 0 };
    }
    offerRevenue[lead.productId].leads += 1;
    if (lead.status === "won") {
      offerRevenue[lead.productId].wonLeads += 1;
      if (lead.closedDealValue) {
        offerRevenue[lead.productId].closedValue += Number(lead.closedDealValue);
      }
    }
  }
  for (const conv of leadConversions) {
    if (!conv.productId) continue;
    if (offerRevenue[conv.productId]) {
      offerRevenue[conv.productId].commission += Number(conv.commission);
    }
  }
  const topOffersByRevenue = Object.entries(offerRevenue)
    .map(([id, v]) => ({ offerId: Number(id), ...v }))
    .filter(o => o.leads > 0)
    .sort((a, b) => b.closedValue - a.closedValue || b.commission - a.commission)
    .slice(0, 8);

  return res.json({
    totalExpectedValue,
    totalClosedDealValue,
    totalActualRevenue,
    avgDealSize,
    totalLeadCommissions,
    expectedVsClosed: { expected: totalExpectedValue, closed: totalClosedDealValue },
    topAffiliatesByRevenue,
    topOffersByRevenue,
  });
});

// ─── AFFILIATE LEADERBOARD ────────────────────────────────────────────────
router.get("/stats/leaderboard", async (req, res) => {
  const refCode = (req.query.ref as string | undefined)?.toUpperCase();

  const [config] = await db.select().from(systemConfigTable);
  if (!config?.leaderboardEnabled) {
    return res.json({ enabled: false, entries: [] });
  }

  const products = await db.select().from(productsTable);
  const excludedSlugs = new Set(products.filter(p => p.excludeFromLeaderboard).map(p => p.slug));
  const excludedIds = new Set(products.filter(p => p.excludeFromLeaderboard).map(p => p.id));

  const affiliates = await db.select().from(affiliatesTable).where(eq(affiliatesTable.status, "active"));
  const allEvents = await db.select().from(referralEventsTable);
  const allConversions = await db.select().from(conversionsTable);

  function isExcluded(productId: number | null, productSlug: string | null, appName: string) {
    if (productId && excludedIds.has(productId)) return true;
    if (productSlug && excludedSlugs.has(productSlug)) return true;
    if (!productId && !productSlug && excludedSlugs.has(appName)) return true;
    return false;
  }

  const filteredEvents = allEvents.filter(e => !isExcluded(e.productId ?? null, e.productSlug ?? null, e.appName));
  const filteredConversions = allConversions.filter(c => !isExcluded(c.productId ?? null, c.productSlug ?? null, c.appName));

  const scored = affiliates.map(a => ({
    affiliateId: a.id,
    refCode: a.refCode,
    clicks: filteredEvents.filter(e => e.affiliateId === a.id && e.eventType === "click").length,
    conversions: filteredConversions.filter(c => c.affiliateId === a.id).length,
    commission: filteredConversions
      .filter(c => c.affiliateId === a.id)
      .reduce((s, c) => s + Number(c.commission), 0),
  }));

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

  const excludedProductNames = products.filter(p => p.excludeFromLeaderboard).map(p => p.name);

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
    .where(and(eq(conversionsTable.status, "HOLD"), lte(conversionsTable.holdEndDate, now)));

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

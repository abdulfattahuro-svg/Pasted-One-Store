import { Router } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, affiliatesTable, productsTable } from "@workspace/db";
import {
  ListAffiliatesQueryParams,
  CreateAffiliateBody,
  GetAffiliateParams,
  UpdateAffiliateParams,
  UpdateAffiliateBody,
  GetAffiliateStatsParams,
} from "@workspace/api-zod";
import {
  referralEventsTable,
  conversionsTable,
} from "@workspace/db";
import { generateRefCode } from "../lib/utils";

const router = Router();

router.get("/affiliates", async (req, res) => {
  const query = ListAffiliatesQueryParams.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }
  const { status, search } = query.data;

  const conditions = [];
  if (status) conditions.push(eq(affiliatesTable.status, status as "active" | "suspended"));
  if (search) {
    conditions.push(
      or(
        ilike(affiliatesTable.name, `%${search}%`),
        ilike(affiliatesTable.email, `%${search}%`),
        ilike(affiliatesTable.refCode, `%${search}%`)
      )!
    );
  }

  const rows = conditions.length > 0
    ? await db.select().from(affiliatesTable).where(conditions.length === 1 ? conditions[0] : conditions.reduce((a, b) => or(a, b)!))
    : await db.select().from(affiliatesTable);

  return res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/affiliates", async (req, res) => {
  const body = CreateAffiliateBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const refCode = generateRefCode(body.data.name);

  const [row] = await db.insert(affiliatesTable).values({
    name: body.data.name,
    email: body.data.email,
    refCode,
    status: "active",
  }).returning();

  return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/affiliates/by-ref/:refCode", async (req, res) => {
  const refCode = req.params.refCode?.toUpperCase();
  if (!refCode) return res.status(400).json({ error: "Missing ref code" });

  const [row] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.refCode, refCode));
  if (!row) return res.status(404).json({ error: "Affiliate not found" });

  return res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/affiliates/:id", async (req, res) => {
  const params = GetAffiliateParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, params.data.id));
  if (!row) return res.status(404).json({ error: "Affiliate not found" });

  return res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/affiliates/:id", async (req, res) => {
  const params = UpdateAffiliateParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateAffiliateBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid request" });

  const updates: Partial<typeof affiliatesTable.$inferInsert> = {};
  if (body.data.status) updates.status = body.data.status as "active" | "suspended";
  if (body.data.name) updates.name = body.data.name;

  const [row] = await db.update(affiliatesTable)
    .set(updates)
    .where(eq(affiliatesTable.id, params.data.id))
    .returning();

  if (!row) return res.status(404).json({ error: "Affiliate not found" });
  return res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/affiliates/:id/stats", async (req, res) => {
  const params = GetAffiliateStatsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const affiliateId = params.data.id;

  const events = await db.select()
    .from(referralEventsTable)
    .where(eq(referralEventsTable.affiliateId, affiliateId));

  const clicks = events.filter(e => e.eventType === "click").length;
  const signups = events.filter(e => e.eventType === "signup").length;

  const conversions = await db.select()
    .from(conversionsTable)
    .where(eq(conversionsTable.affiliateId, affiliateId));

  const holdAmount = conversions
    .filter(c => c.status === "HOLD")
    .reduce((s, c) => s + Number(c.commission), 0);
  const payableAmount = conversions
    .filter(c => c.status === "PAYABLE")
    .reduce((s, c) => s + Number(c.commission), 0);
  const paidAmount = conversions
    .filter(c => c.status === "PAID")
    .reduce((s, c) => s + Number(c.commission), 0);

  return res.json({
    affiliateId,
    clicks,
    signups,
    conversions: conversions.length,
    holdAmount,
    payableAmount,
    paidAmount,
    totalEarnings: holdAmount + payableAmount + paidAmount,
  });
});

// ─── PER-PRODUCT STATS FOR AN AFFILIATE ──────────────────────
router.get("/affiliates/:id/product-stats", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [affiliate] = await db.select({ id: affiliatesTable.id, refCode: affiliatesTable.refCode })
    .from(affiliatesTable)
    .where(eq(affiliatesTable.id, id));
  if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });

  const products = await db.select().from(productsTable).where(eq(productsTable.active, true));
  const events = await db.select().from(referralEventsTable).where(eq(referralEventsTable.affiliateId, id));
  const conversions = await db.select().from(conversionsTable).where(eq(conversionsTable.affiliateId, id));

  const origin = req.headers.origin ?? `https://${req.headers.host ?? "localhost"}`;

  const stats = products.map(product => {
    const productEvents = events.filter(e => e.productSlug === product.slug || e.appName === product.slug);
    const productConversions = conversions.filter(c => c.productSlug === product.slug || c.appName === product.slug);

    const clicks = productEvents.filter(e => e.eventType === "click").length;
    const signups = productEvents.filter(e => e.eventType === "signup").length;
    const totalConversions = productConversions.length;
    const revenue = productConversions.reduce((s, c) => s + Number(c.amount), 0);
    const commission = productConversions.reduce((s, c) => s + Number(c.commission), 0);

    // Build the canonical referral link for this product
    const refLink = `${origin}/product/${product.slug}?ref=${affiliate.refCode}`;

    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productDescription: product.description,
      productCategory: product.category,
      refLink,
      clicks,
      signups,
      conversions: totalConversions,
      revenue,
      commission,
    };
  });

  return res.json(stats);
});

// ─── DELETE AFFILIATE ─────────────────────────────────────────
router.delete("/affiliates/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(affiliatesTable).where(eq(affiliatesTable.id, id));
  return res.json({ ok: true });
});

export default router;

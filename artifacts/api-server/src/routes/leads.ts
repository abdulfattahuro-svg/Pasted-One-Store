import { Router } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { db, affiliatesTable, productsTable } from "@workspace/db";
import { leadsTable } from "@workspace/db";

const router = Router();

const VALID_STATUSES = ["new", "contacted", "interested", "won", "lost"] as const;
type LeadStatus = (typeof VALID_STATUSES)[number];

function serializeLead(lead: typeof leadsTable.$inferSelect) {
  return {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    approvedAt: lead.approvedAt?.toISOString() ?? null,
    convertedAt: lead.convertedAt?.toISOString() ?? null,
  };
}

router.get("/leads", async (req, res) => {
  const { status, affiliateId, productSlug, search } = req.query as Record<string, string>;

  const conditions = [];
  if (status) conditions.push(eq(leadsTable.status, status as "new" | "contacted" | "interested" | "won" | "lost"));
  if (affiliateId) conditions.push(eq(leadsTable.affiliateId, Number(affiliateId)));
  if (productSlug) conditions.push(eq(leadsTable.productSlug, productSlug));
  if (search) {
    conditions.push(
      or(
        ilike(leadsTable.fullName, `%${search}%`),
        ilike(leadsTable.email, `%${search}%`),
        ilike(leadsTable.phone, `%${search}%`),
      )!
    );
  }

  const rows = conditions.length > 0
    ? await db.select().from(leadsTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(leadsTable.createdAt))
    : await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));

  const affiliateIds = [...new Set(rows.map(r => r.affiliateId))];
  const productIds = [...new Set(rows.map(r => r.productId).filter(Boolean) as number[])];

  const [affiliates, products] = await Promise.all([
    affiliateIds.length > 0
      ? db.select({ id: affiliatesTable.id, name: affiliatesTable.name, email: affiliatesTable.email }).from(affiliatesTable)
      : Promise.resolve([]),
    productIds.length > 0
      ? db.select({ id: productsTable.id, name: productsTable.name, slug: productsTable.slug }).from(productsTable)
      : Promise.resolve([]),
  ]);

  const affiliateMap = new Map(affiliates.map(a => [a.id, a]));
  const productMap = new Map(products.map(p => [p.id, p]));

  return res.json(rows.map(r => ({
    ...serializeLead(r),
    affiliate: affiliateMap.get(r.affiliateId) ?? null,
    product: r.productId ? (productMap.get(r.productId) ?? null) : null,
  })));
});

router.post("/leads", async (req, res) => {
  const { fullName, phone, email, notes, productId, productSlug: bodyProductSlug } = req.body as Record<string, unknown>;
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ error: "fullName is required" });
  }

  let affiliateId: number;
  let affiliateCode: string;
  let source: "affiliate_submission" | "api" = "api";

  if (req.session.affiliateId) {
    affiliateId = req.session.affiliateId;
    const [aff] = await db.select({ id: affiliatesTable.id, refCode: affiliatesTable.refCode })
      .from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId));
    if (!aff) return res.status(404).json({ error: "Affiliate not found" });
    affiliateCode = aff.refCode;
    source = "affiliate_submission";
  } else if (req.body.affiliateId) {
    affiliateId = Number(req.body.affiliateId);
    const [aff] = await db.select({ id: affiliatesTable.id, refCode: affiliatesTable.refCode })
      .from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId));
    if (!aff) return res.status(404).json({ error: "Affiliate not found" });
    affiliateCode = aff.refCode;
  } else {
    return res.status(400).json({ error: "affiliateId required (session or body)" });
  }

  const parsedProductId = productId ? Number(productId) : null;
  let resolvedProductSlug = typeof bodyProductSlug === "string" ? bodyProductSlug : null;
  if (parsedProductId && !resolvedProductSlug) {
    const [prod] = await db.select({ slug: productsTable.slug })
      .from(productsTable).where(eq(productsTable.id, parsedProductId));
    resolvedProductSlug = prod?.slug ?? null;
  }

  const [row] = await db.insert(leadsTable).values({
    affiliateId,
    affiliateCode,
    productId: parsedProductId,
    productSlug: resolvedProductSlug,
    fullName: String(fullName).trim(),
    phone: phone && typeof phone === "string" ? phone.trim() || null : null,
    email: email && typeof email === "string" ? email.trim() || null : null,
    notes: notes && typeof notes === "string" ? notes.trim() || null : null,
    source,
  }).returning();

  return res.status(201).json(serializeLead(row));
});

router.get("/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!row) return res.status(404).json({ error: "Lead not found" });

  return res.json(serializeLead(row));
});

router.patch("/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { status, notes, approvedAt, convertedAt } = req.body as Record<string, unknown>;

  const updates: Partial<typeof leadsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (status) {
    if (!VALID_STATUSES.includes(status as LeadStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    updates.status = status as LeadStatus;
  }
  if (notes !== undefined) updates.notes = notes === null ? null : String(notes);
  if (approvedAt && typeof approvedAt === "string") updates.approvedAt = new Date(approvedAt);
  if (convertedAt && typeof convertedAt === "string") updates.convertedAt = new Date(convertedAt);

  const [row] = await db.update(leadsTable)
    .set(updates)
    .where(eq(leadsTable.id, id))
    .returning();

  if (!row) return res.status(404).json({ error: "Lead not found" });
  return res.json(serializeLead(row));
});

router.get("/affiliates/:id/leads", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  if (req.session.affiliateId && req.session.affiliateId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { status, search } = req.query as Record<string, string>;
  const conditions = [eq(leadsTable.affiliateId, id)];
  if (status) conditions.push(eq(leadsTable.status, status as "new" | "contacted" | "interested" | "won" | "lost"));
  if (search) {
    conditions.push(
      or(
        ilike(leadsTable.fullName, `%${search}%`),
        ilike(leadsTable.email, `%${search}%`),
        ilike(leadsTable.phone, `%${search}%`),
      )!
    );
  }

  const rows = await db.select().from(leadsTable)
    .where(and(...conditions))
    .orderBy(desc(leadsTable.createdAt));

  const productIds = [...new Set(rows.map(r => r.productId).filter(Boolean) as number[])];
  const products = productIds.length > 0
    ? await db.select({ id: productsTable.id, name: productsTable.name, slug: productsTable.slug }).from(productsTable)
    : [];
  const productMap = new Map(products.map(p => [p.id, p]));

  return res.json(rows.map(r => ({
    ...serializeLead(r),
    product: r.productId ? (productMap.get(r.productId) ?? null) : null,
  })));
});

export default router;

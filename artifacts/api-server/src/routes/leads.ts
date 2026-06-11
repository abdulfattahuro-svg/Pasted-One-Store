import { Router } from "express";
import { eq, ilike, or, and, desc, like } from "drizzle-orm";
import { db, affiliatesTable, productsTable, conversionsTable, systemConfigTable } from "@workspace/db";
import { leadsTable } from "@workspace/db";
import { offerCommissionRulesTable } from "@workspace/db";
import { leadHistoryTable } from "@workspace/db";

const router = Router();

const VALID_STATUSES = ["new", "contacted", "interested", "approved", "won", "lost", "rejected"] as const;
type LeadStatus = (typeof VALID_STATUSES)[number];

function serializeLead(lead: typeof leadsTable.$inferSelect) {
  return {
    ...lead,
    expectedValue: lead.expectedValue ?? null,
    closedDealValue: lead.closedDealValue ?? null,
    actualRevenue: lead.actualRevenue ?? null,
    payoutAmount: lead.payoutAmount ?? null,
    currency: lead.currency,
    metadata: lead.metadata ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    approvedAt: lead.approvedAt?.toISOString() ?? null,
    rejectedAt: lead.rejectedAt?.toISOString() ?? null,
    wonAt: lead.wonAt?.toISOString() ?? null,
    lostAt: lead.lostAt?.toISOString() ?? null,
    convertedAt: lead.convertedAt?.toISOString() ?? null,
  };
}

// ─── Commission trigger engine ─────────────────────────────────────────────
// Supports Fixed, Percentage (of deal value), Hybrid (fixed + % of deal value)
async function triggerLeadCommission(lead: typeof leadsTable.$inferSelect, triggerEvent: string) {
  if (!lead.productId && !lead.productSlug) return;
  const offerId = lead.productId;
  if (!offerId) return;

  const rules = await db
    .select()
    .from(offerCommissionRulesTable)
    .where(
      and(
        eq(offerCommissionRulesTable.offerId, offerId),
        eq(offerCommissionRulesTable.triggerEvent, triggerEvent),
        eq(offerCommissionRulesTable.isActive, true)
      )
    );
  if (!rules.length) return;

  const rule = rules[0];
  const paymentId = `lead-${lead.id}-${triggerEvent}`;

  const existing = await db
    .select({ id: conversionsTable.id })
    .from(conversionsTable)
    .where(eq(conversionsTable.paymentId, paymentId));
  if (existing.length > 0) return;

  const [config] = await db.select().from(systemConfigTable);
  const holdDays = config?.holdDays ?? 14;

  const ruleValue = Number(rule.commissionValue);

  // Prefer closed deal value for won deals, fall back to expected value
  const dealValue =
    lead.closedDealValue && Number(lead.closedDealValue) > 0
      ? Number(lead.closedDealValue)
      : lead.expectedValue && Number(lead.expectedValue) > 0
        ? Number(lead.expectedValue)
        : null;

  let commission: number;
  if (rule.commissionType === "fixed") {
    commission = ruleValue;
  } else if (rule.commissionType === "percentage") {
    // e.g. ruleValue = 10 means 10% of deal value
    commission = dealValue ? Math.round((ruleValue / 100) * dealValue) : ruleValue;
  } else if (rule.commissionType === "hybrid") {
    // fixed + % of deal value
    const pct = rule.recurringPercentage ? Number(rule.recurringPercentage) : 0;
    commission = dealValue ? Math.round(ruleValue + (pct / 100) * dealValue) : ruleValue + pct;
  } else {
    commission = ruleValue;
  }

  const holdEndDate = new Date();
  holdEndDate.setDate(holdEndDate.getDate() + holdDays);

  await db.insert(conversionsTable).values({
    affiliateId: lead.affiliateId,
    userId: `lead-${lead.id}`,
    appName: lead.productSlug ?? String(offerId),
    paymentId,
    amount: String(dealValue ?? ruleValue),
    commission: String(commission),
    status: "HOLD",
    holdEndDate,
    productId: lead.productId ?? undefined,
    productSlug: lead.productSlug ?? undefined,
    conversionType: triggerEvent,
    source: "lead_trigger",
  });
}

// ─── Log history ──────────────────────────────────────────────────────────
async function logLeadHistory(
  leadId: number,
  previousStatus: string | null,
  newStatus: string,
  changedBy?: string,
  notes?: string
) {
  await db.insert(leadHistoryTable).values({
    leadId,
    changedBy: changedBy ?? null,
    previousStatus: previousStatus ?? null,
    newStatus,
    notes: notes ?? null,
  });
}

// ─── GET /leads ───────────────────────────────────────────────────────────
router.get("/leads", async (req, res) => {
  const { status, affiliateId, productSlug, search } = req.query as Record<string, string>;

  const conditions = [];
  if (status) conditions.push(eq(leadsTable.status, status as LeadStatus));
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

// ─── POST /leads ──────────────────────────────────────────────────────────
router.post("/leads", async (req, res) => {
  const { fullName, phone, email, notes, productId, productSlug: bodyProductSlug, expectedValue, currency } = req.body as Record<string, unknown>;
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
  let resolvedOfferName: string | null = null;

  if (parsedProductId) {
    const [prod] = await db.select({ slug: productsTable.slug, name: productsTable.name })
      .from(productsTable).where(eq(productsTable.id, parsedProductId));
    if (prod) {
      resolvedProductSlug = resolvedProductSlug ?? prod.slug;
      resolvedOfferName = prod.name;
    }
  }

  const [row] = await db.insert(leadsTable).values({
    affiliateId,
    affiliateCode,
    productId: parsedProductId,
    productSlug: resolvedProductSlug,
    offerName: resolvedOfferName,
    fullName: String(fullName).trim(),
    phone: phone && typeof phone === "string" ? phone.trim() || null : null,
    email: email && typeof email === "string" ? email.trim() || null : null,
    notes: notes && typeof notes === "string" ? notes.trim() || null : null,
    source,
    expectedValue: expectedValue != null ? String(expectedValue) : undefined,
    currency: currency && typeof currency === "string" ? currency : "NGN",
  }).returning();

  await logLeadHistory(row.id, null, "new", undefined, "Lead created");
  await triggerLeadCommission(row, "lead_submitted").catch(() => {});

  return res.status(201).json(serializeLead(row));
});

// ─── GET /leads/export — CSV (must be BEFORE /leads/:id) ─────────────────
router.get("/leads/export", async (req, res) => {
  const rows = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));

  const affiliateIds = [...new Set(rows.map(r => r.affiliateId))];
  const affiliates = affiliateIds.length > 0
    ? await db.select({ id: affiliatesTable.id, name: affiliatesTable.name }).from(affiliatesTable)
    : [];
  const affiliateMap = new Map(affiliates.map(a => [a.id, a.name]));

  const headers = [
    "ID", "Full Name", "Email", "Phone", "Status", "Offer", "Affiliate", "Ref Code",
    "Expected Value", "Closed Deal Value", "Revenue", "Payout Amount", "Currency",
    "Notes", "Source", "Approved At", "Won At", "Created At",
  ];

  const esc = (v: string | null | undefined | number) =>
    `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;

  const csvRows = rows.map(r => [
    r.id, r.fullName, r.email ?? "", r.phone ?? "", r.status,
    r.offerName ?? r.productSlug ?? "", affiliateMap.get(r.affiliateId) ?? "", r.affiliateCode,
    r.expectedValue ?? "", r.closedDealValue ?? "", r.actualRevenue ?? "", r.payoutAmount ?? "",
    r.currency, r.notes ?? "", r.source,
    r.approvedAt?.toISOString() ?? "", r.wonAt?.toISOString() ?? "", r.createdAt.toISOString(),
  ].map(esc).join(","));

  const csv = [headers.map(esc).join(","), ...csvRows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="leads-${Date.now()}.csv"`);
  return res.send(csv);
});

// ─── GET /leads/:id — enriched single lead ────────────────────────────────
router.get("/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!row) return res.status(404).json({ error: "Lead not found" });

  const [affiliateRows, productRows, history, commissions] = await Promise.all([
    db
      .select({ id: affiliatesTable.id, name: affiliatesTable.name, email: affiliatesTable.email, refCode: affiliatesTable.refCode })
      .from(affiliatesTable)
      .where(eq(affiliatesTable.id, row.affiliateId)),
    row.productId
      ? db
          .select({ id: productsTable.id, name: productsTable.name, slug: productsTable.slug })
          .from(productsTable)
          .where(eq(productsTable.id, row.productId))
      : Promise.resolve([]),
    db
      .select()
      .from(leadHistoryTable)
      .where(eq(leadHistoryTable.leadId, id))
      .orderBy(desc(leadHistoryTable.createdAt)),
    db
      .select()
      .from(conversionsTable)
      .where(
        and(
          eq(conversionsTable.affiliateId, row.affiliateId),
          like(conversionsTable.paymentId, `lead-${id}-%`)
        )
      )
      .orderBy(desc(conversionsTable.conversionDate)),
  ]);

  return res.json({
    ...serializeLead(row),
    affiliate: affiliateRows[0] ?? null,
    product: productRows[0] ?? null,
    history: history.map(h => ({ ...h, createdAt: h.createdAt.toISOString() })),
    commissions: commissions.map(c => ({
      id: c.id,
      paymentId: c.paymentId,
      conversionType: c.conversionType,
      commission: Number(c.commission),
      amount: Number(c.amount),
      status: c.status,
      conversionDate: c.conversionDate.toISOString(),
    })),
  });
});

// ─── GET /leads/:id/history ───────────────────────────────────────────────
router.get("/leads/:id/history", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const history = await db
    .select()
    .from(leadHistoryTable)
    .where(eq(leadHistoryTable.leadId, id))
    .orderBy(desc(leadHistoryTable.createdAt));

  return res.json(history.map(h => ({
    ...h,
    createdAt: h.createdAt.toISOString(),
  })));
});

// ─── PATCH /leads/:id — update status + deal values ──────────────────────
router.patch("/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const {
    status, notes, rejectedReason,
    expectedValue, closedDealValue, actualRevenue, payoutAmount, currency,
  } = req.body as Record<string, unknown>;

  const adminLabel = (req.session as Record<string, unknown>)?.adminEmail
    ? String((req.session as Record<string, unknown>).adminEmail)
    : "admin";

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Lead not found" });

  const updates: Partial<typeof leadsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (notes !== undefined) updates.notes = notes === null ? null : String(notes);

  // Deal value fields
  if (expectedValue !== undefined) {
    updates.expectedValue = expectedValue === null ? null : String(expectedValue);
  }
  if (closedDealValue !== undefined) {
    updates.closedDealValue = closedDealValue === null ? null : String(closedDealValue);
  }
  if (actualRevenue !== undefined) {
    updates.actualRevenue = actualRevenue === null ? null : String(actualRevenue);
  }
  if (payoutAmount !== undefined) {
    updates.payoutAmount = payoutAmount === null ? null : String(payoutAmount);
  }
  if (currency !== undefined && typeof currency === "string") {
    updates.currency = currency;
  }

  if (status) {
    if (!VALID_STATUSES.includes(status as LeadStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    const newStatus = status as LeadStatus;
    updates.status = newStatus;

    if (newStatus === "approved") {
      updates.approvedAt = new Date();
      updates.approvedBy = adminLabel;
    } else if (newStatus === "rejected") {
      updates.rejectedAt = new Date();
      updates.rejectedReason = rejectedReason ? String(rejectedReason) : null;
    } else if (newStatus === "won") {
      updates.wonAt = new Date();
    } else if (newStatus === "lost") {
      updates.lostAt = new Date();
    }
  }

  const [row] = await db.update(leadsTable)
    .set(updates)
    .where(eq(leadsTable.id, id))
    .returning();

  if (status && status !== existing.status) {
    await logLeadHistory(
      id,
      existing.status,
      String(status),
      adminLabel,
      rejectedReason ? String(rejectedReason) : undefined
    );

    if (status === "approved") {
      await triggerLeadCommission(row, "lead_approved").catch(() => {});
    } else if (status === "won") {
      await triggerLeadCommission(row, "deal_won").catch(() => {});
    }
  }

  return res.json(serializeLead(row));
});

// ─── GET /affiliates/:id/leads ────────────────────────────────────────────
router.get("/affiliates/:id/leads", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  if (req.session.affiliateId && req.session.affiliateId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { status, search } = req.query as Record<string, string>;
  const conditions = [eq(leadsTable.affiliateId, id)];
  if (status) conditions.push(eq(leadsTable.status, status as LeadStatus));
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

// ─── GET /affiliates/:id/lead-stats — financial stats for portal ──────────
router.get("/affiliates/:id/lead-stats", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  if (req.session.affiliateId && req.session.affiliateId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [leads, commissions] = await Promise.all([
    db.select().from(leadsTable).where(eq(leadsTable.affiliateId, id)),
    db.select().from(conversionsTable).where(
      and(
        eq(conversionsTable.affiliateId, id),
        eq(conversionsTable.source, "lead_trigger")
      )
    ),
  ]);

  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === "won").length;
  const approvedLeads = leads.filter(l => l.status === "approved" || l.status === "won").length;
  const winRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  const totalExpectedValue = leads.reduce((s, l) => s + (l.expectedValue ? Number(l.expectedValue) : 0), 0);
  const totalWonValue = leads
    .filter(l => l.status === "won")
    .reduce((s, l) => s + (l.closedDealValue ? Number(l.closedDealValue) : 0), 0);

  const holdEarnings = commissions.filter(c => c.status === "HOLD").reduce((s, c) => s + Number(c.commission), 0);
  const payableEarnings = commissions.filter(c => c.status === "PAYABLE").reduce((s, c) => s + Number(c.commission), 0);
  const paidEarnings = commissions.filter(c => c.status === "PAID").reduce((s, c) => s + Number(c.commission), 0);
  const totalEarnings = commissions.reduce((s, c) => s + Number(c.commission), 0);

  return res.json({
    totalLeads,
    wonLeads,
    approvedLeads,
    winRate,
    totalExpectedValue,
    totalWonValue,
    holdEarnings,
    payableEarnings,
    paidEarnings,
    totalEarnings,
  });
});

// ─── GET /affiliates/:id/leads/export — CSV for portal ───────────────────
router.get("/affiliates/:id/leads/export", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  if (req.session.affiliateId && req.session.affiliateId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await db.select().from(leadsTable)
    .where(eq(leadsTable.affiliateId, id))
    .orderBy(desc(leadsTable.createdAt));

  const productIds = [...new Set(rows.map(r => r.productId).filter(Boolean) as number[])];
  const products = productIds.length > 0
    ? await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable)
    : [];
  const productMap = new Map(products.map(p => [p.id, p.name]));

  const headers = [
    "ID", "Full Name", "Email", "Phone", "Status", "Offer",
    "Expected Value", "Closed Deal Value", "Payout Amount", "Currency",
    "Notes", "Submitted At", "Approved At", "Won At",
  ];

  const esc = (v: string | null | undefined | number) =>
    `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;

  const csvRows = rows.map(r => [
    r.id, r.fullName, r.email ?? "", r.phone ?? "", r.status,
    r.offerName ?? (r.productId ? (productMap.get(r.productId) ?? "") : "") ?? r.productSlug ?? "",
    r.expectedValue ?? "", r.closedDealValue ?? "", r.payoutAmount ?? "",
    r.currency, r.notes ?? "",
    r.createdAt.toISOString(), r.approvedAt?.toISOString() ?? "", r.wonAt?.toISOString() ?? "",
  ].map(esc).join(","));

  const csv = [headers.map(esc).join(","), ...csvRows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="my-leads-${Date.now()}.csv"`);
  return res.send(csv);
});

export default router;

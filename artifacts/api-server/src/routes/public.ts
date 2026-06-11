import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, affiliatesTable, conversionsTable, systemConfigTable } from "@workspace/db";
import { offerApiKeysTable } from "@workspace/db";
import { leadsTable } from "@workspace/db";
import { offerCommissionRulesTable } from "@workspace/db";
import { leadHistoryTable } from "@workspace/db";

const router = Router();

type ResolvedOffer = { offerId: number; offerSlug: string; offerName: string };

async function resolveApiKey(
  req: Parameters<Parameters<typeof router.use>[0]>[0],
  res: Parameters<Parameters<typeof router.use>[0]>[1]
): Promise<ResolvedOffer | null> {
  const authHeader = req.headers.authorization;
  const apiKey =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    (req.headers["x-api-key"] as string | undefined) ??
    null;

  if (!apiKey) {
    res.status(401).json({ error: "API key required. Provide via Authorization: Bearer <key> or X-API-Key header." });
    return null;
  }

  const [keyRow] = await db
    .select()
    .from(offerApiKeysTable)
    .where(eq(offerApiKeysTable.apiKey, apiKey));

  if (!keyRow) {
    res.status(401).json({ error: "Invalid API key." });
    return null;
  }

  if (keyRow.status === "disabled") {
    res.status(403).json({ error: "API key is disabled." });
    return null;
  }

  await db
    .update(offerApiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(offerApiKeysTable.id, keyRow.id));

  const [offer] = await db
    .select({ id: productsTable.id, slug: productsTable.slug, name: productsTable.name })
    .from(productsTable)
    .where(eq(productsTable.id, keyRow.offerId));

  if (!offer) {
    res.status(404).json({ error: "Offer associated with this API key no longer exists." });
    return null;
  }

  return { offerId: offer.id, offerSlug: offer.slug, offerName: offer.name };
}

// ─── Commission trigger for API leads (supports % of deal value) ──────────
async function triggerLeadCommission(lead: typeof leadsTable.$inferSelect, triggerEvent: string) {
  if (!lead.productId) return;
  const { and: drizzleAnd } = await import("drizzle-orm");

  const rules = await db
    .select()
    .from(offerCommissionRulesTable)
    .where(
      drizzleAnd(
        eq(offerCommissionRulesTable.offerId, lead.productId),
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

  // Use closedDealValue first, fall back to expectedValue for % calculations
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
    commission = dealValue ? Math.round((ruleValue / 100) * dealValue) : ruleValue;
  } else if (rule.commissionType === "hybrid") {
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
    appName: lead.productSlug ?? String(lead.productId),
    paymentId,
    amount: String(dealValue ?? ruleValue),
    commission: String(commission),
    status: "HOLD",
    holdEndDate,
    productId: lead.productId,
    productSlug: lead.productSlug ?? undefined,
    conversionType: triggerEvent,
    source: "lead_trigger",
  });
}

router.post("/public/events", async (req, res) => {
  const offer = await resolveApiKey(req, res);
  if (!offer) return;

  return res.status(202).json({
    ok: true,
    message: "Event received.",
    offerId: offer.offerId,
    offerSlug: offer.offerSlug,
    offerName: offer.offerName,
  });
});

router.post("/public/conversions", async (req, res) => {
  const offer = await resolveApiKey(req, res);
  if (!offer) return;

  return res.status(202).json({
    ok: true,
    message: "Conversion received.",
    offerId: offer.offerId,
    offerSlug: offer.offerSlug,
    offerName: offer.offerName,
  });
});

router.post("/public/leads", async (req, res) => {
  const offer = await resolveApiKey(req, res);
  if (!offer) return;

  const { affiliateCode, fullName, phone, email, notes, source, metadata, expectedValue, currency } = req.body as Record<string, unknown>;

  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ error: "fullName is required" });
  }

  let affiliateId: number | null = null;
  let resolvedAffiliateCode = "";

  if (affiliateCode && typeof affiliateCode === "string") {
    const [aff] = await db
      .select({ id: affiliatesTable.id, refCode: affiliatesTable.refCode })
      .from(affiliatesTable)
      .where(eq(affiliatesTable.refCode, affiliateCode.toUpperCase()));

    if (aff) {
      affiliateId = aff.id;
      resolvedAffiliateCode = aff.refCode;
    }
  }

  if (!affiliateId) {
    return res.status(400).json({ error: "Valid affiliateCode is required." });
  }

  const [row] = await db.insert(leadsTable).values({
    affiliateId,
    affiliateCode: resolvedAffiliateCode,
    productId: offer.offerId,
    productSlug: offer.offerSlug,
    offerName: offer.offerName,
    fullName: String(fullName).trim(),
    phone: phone && typeof phone === "string" ? phone.trim() || null : null,
    email: email && typeof email === "string" ? email.trim() || null : null,
    notes: notes && typeof notes === "string" ? notes.trim() || null : null,
    source: (source === "website_form" || source === "api" || source === "import") ? source : "api",
    metadata: metadata && typeof metadata === "object" ? metadata : null,
    expectedValue: expectedValue != null ? String(expectedValue) : undefined,
    currency: currency && typeof currency === "string" ? currency : "NGN",
  }).returning();

  await db.insert(leadHistoryTable).values({
    leadId: row.id,
    changedBy: `api-key`,
    previousStatus: null,
    newStatus: "new",
    notes: "Lead created via public API",
  });

  await triggerLeadCommission(row, "lead_submitted").catch(() => {});

  return res.status(201).json({
    success: true,
    leadId: row.id,
    offerName: offer.offerName,
  });
});

export default router;

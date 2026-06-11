import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { offerCommissionRulesTable, TRIGGER_EVENTS } from "@workspace/db";

const router = Router();

const COMMISSION_TYPES = ["fixed", "percentage", "hybrid"] as const;

function serializeRule(rule: typeof offerCommissionRulesTable.$inferSelect) {
  return {
    ...rule,
    commissionValue: Number(rule.commissionValue),
    recurringPercentage: rule.recurringPercentage !== null ? Number(rule.recurringPercentage) : null,
    createdAt: rule.createdAt.toISOString(),
  };
}

router.get("/products/:id/commission-rules", async (req, res) => {
  const offerId = Number(req.params.id);
  if (isNaN(offerId)) return res.status(400).json({ error: "Invalid offer id" });

  const [offer] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(eq(productsTable.id, offerId));
  if (!offer) return res.status(404).json({ error: "Offer not found" });

  const rules = await db.select().from(offerCommissionRulesTable)
    .where(eq(offerCommissionRulesTable.offerId, offerId));

  return res.json(rules.map(serializeRule));
});

router.post("/products/:id/commission-rules", async (req, res) => {
  const offerId = Number(req.params.id);
  if (isNaN(offerId)) return res.status(400).json({ error: "Invalid offer id" });

  const { triggerEvent, commissionType, commissionValue, recurringEnabled, recurringPercentage } = req.body as Record<string, unknown>;

  if (!triggerEvent || !TRIGGER_EVENTS.includes(triggerEvent as typeof TRIGGER_EVENTS[number])) {
    return res.status(400).json({ error: `triggerEvent must be one of: ${TRIGGER_EVENTS.join(", ")}` });
  }
  if (!commissionType || !COMMISSION_TYPES.includes(commissionType as typeof COMMISSION_TYPES[number])) {
    return res.status(400).json({ error: `commissionType must be one of: ${COMMISSION_TYPES.join(", ")}` });
  }
  if (commissionValue === undefined || isNaN(Number(commissionValue))) {
    return res.status(400).json({ error: "commissionValue must be a number" });
  }

  const existing = await db.select({ id: offerCommissionRulesTable.id })
    .from(offerCommissionRulesTable)
    .where(and(
      eq(offerCommissionRulesTable.offerId, offerId),
      eq(offerCommissionRulesTable.triggerEvent, String(triggerEvent))
    ));

  if (existing.length > 0) {
    return res.status(409).json({ error: "A rule for this trigger event already exists on this offer." });
  }

  const [rule] = await db.insert(offerCommissionRulesTable).values({
    offerId,
    triggerEvent: String(triggerEvent),
    commissionType: String(commissionType),
    commissionValue: String(Number(commissionValue)),
    recurringEnabled: Boolean(recurringEnabled),
    recurringPercentage: recurringPercentage !== undefined && recurringPercentage !== null
      ? String(Number(recurringPercentage))
      : null,
  }).returning();

  return res.status(201).json(serializeRule(rule));
});

router.patch("/products/:id/commission-rules/:ruleId", async (req, res) => {
  const offerId = Number(req.params.id);
  const ruleId = Number(req.params.ruleId);
  if (isNaN(offerId) || isNaN(ruleId)) return res.status(400).json({ error: "Invalid id" });

  const { commissionType, commissionValue, recurringEnabled, recurringPercentage, isActive } = req.body as Record<string, unknown>;

  const updates: Partial<typeof offerCommissionRulesTable.$inferInsert> = {};
  if (commissionType !== undefined) {
    if (!COMMISSION_TYPES.includes(commissionType as typeof COMMISSION_TYPES[number])) {
      return res.status(400).json({ error: `Invalid commissionType` });
    }
    updates.commissionType = String(commissionType);
  }
  if (commissionValue !== undefined) updates.commissionValue = String(Number(commissionValue));
  if (recurringEnabled !== undefined) updates.recurringEnabled = Boolean(recurringEnabled);
  if (recurringPercentage !== undefined) updates.recurringPercentage = recurringPercentage !== null ? String(Number(recurringPercentage)) : null;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  const [rule] = await db.update(offerCommissionRulesTable)
    .set(updates)
    .where(and(
      eq(offerCommissionRulesTable.id, ruleId),
      eq(offerCommissionRulesTable.offerId, offerId)
    ))
    .returning();

  if (!rule) return res.status(404).json({ error: "Rule not found" });
  return res.json(serializeRule(rule));
});

router.delete("/products/:id/commission-rules/:ruleId", async (req, res) => {
  const offerId = Number(req.params.id);
  const ruleId = Number(req.params.ruleId);
  if (isNaN(offerId) || isNaN(ruleId)) return res.status(400).json({ error: "Invalid id" });

  const [deleted] = await db.delete(offerCommissionRulesTable)
    .where(and(
      eq(offerCommissionRulesTable.id, ruleId),
      eq(offerCommissionRulesTable.offerId, offerId)
    ))
    .returning();

  if (!deleted) return res.status(404).json({ error: "Rule not found" });
  return res.json({ ok: true });
});

export default router;

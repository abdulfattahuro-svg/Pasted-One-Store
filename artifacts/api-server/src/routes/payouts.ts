import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, payoutsTable } from "@workspace/db";
import {
  ListPayoutsQueryParams,
  CreatePayoutBody,
  MarkPayoutPaidParams,
} from "@workspace/api-zod";

const router = Router();

function formatPayout(p: typeof payoutsTable.$inferSelect) {
  return {
    ...p,
    amount: Number(p.amount),
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  };
}

router.get("/payouts", async (req, res) => {
  const query = ListPayoutsQueryParams.safeParse({
    ...req.query,
    affiliateId: req.query.affiliateId ? Number(req.query.affiliateId) : undefined,
  });
  if (!query.success) return res.status(400).json({ error: "Invalid query params" });

  const { affiliateId, status } = query.data;

  let rows = await db.select().from(payoutsTable);

  if (affiliateId) rows = rows.filter(r => r.affiliateId === affiliateId);
  if (status) rows = rows.filter(r => r.status === status);

  rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return res.json(rows.map(formatPayout));
});

router.post("/payouts", async (req, res) => {
  const body = CreatePayoutBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const [row] = await db.insert(payoutsTable).values({
    affiliateId: body.data.affiliateId,
    amount: String(body.data.amount),
    status: "PENDING",
  }).returning();

  return res.status(201).json(formatPayout(row));
});

router.patch("/payouts/:id/mark-paid", async (req, res) => {
  const params = MarkPayoutPaidParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db.update(payoutsTable)
    .set({ status: "PAID", paidAt: new Date() })
    .where(eq(payoutsTable.id, params.data.id))
    .returning();

  if (!row) return res.status(404).json({ error: "Payout not found" });

  return res.json(formatPayout(row));
});

export default router;

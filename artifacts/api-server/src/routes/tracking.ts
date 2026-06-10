import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, affiliatesTable, referralEventsTable } from "@workspace/db";

const router = Router();

router.get("/track", async (req, res) => {
  const ref = (req.query.ref as string | undefined)?.toUpperCase();
  const app = (req.query.app as string | undefined) ?? "unknown";
  const redirect = (req.query.redirect as string | undefined);

  if (!ref) {
    return res.status(400).json({ error: "ref parameter required" });
  }

  const [affiliate] = await db
    .select({ id: affiliatesTable.id, status: affiliatesTable.status })
    .from(affiliatesTable)
    .where(eq(affiliatesTable.refCode, ref));

  if (affiliate && affiliate.status === "active") {
    await db.insert(referralEventsTable).values({
      affiliateId: affiliate.id,
      appName: app,
      eventType: "click",
      metadata: { userAgent: req.headers["user-agent"] ?? null, ip: req.ip ?? null },
    }).catch(() => {});
  }

  if (redirect) {
    return res.redirect(302, redirect);
  }

  res.json({ ok: true, tracked: !!affiliate });
});

export default router;

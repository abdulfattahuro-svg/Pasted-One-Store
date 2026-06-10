import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, affiliatesTable, referralEventsTable, productsTable } from "@workspace/db";

const router = Router();

// Legacy redirect-style tracking: /api/track?ref=CODE&app=SLUG&redirect=URL
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
    // Resolve product by slug
    let productId: number | null = null;
    if (app && app !== "unknown") {
      const [product] = await db.select({ id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.slug, app));
      productId = product?.id ?? null;
    }

    await db.insert(referralEventsTable).values({
      affiliateId: affiliate.id,
      refCode: ref,
      appName: app,
      eventType: "click",
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || null,
      productId,
      productSlug: app !== "unknown" ? app : null,
    }).catch(() => {});
  }

  if (redirect) {
    return res.redirect(302, redirect);
  }

  res.json({ ok: true, tracked: !!affiliate });
});

// Product-slug tracking endpoint: POST /api/track/product
// Used by the /product/:slug frontend page on mount
router.post("/track/product", async (req, res) => {
  const { refCode, productSlug } = req.body as { refCode?: string; productSlug?: string };

  if (!refCode || !productSlug) {
    return res.status(400).json({ error: "refCode and productSlug required" });
  }

  const ref = refCode.toUpperCase();

  const [affiliate] = await db
    .select({ id: affiliatesTable.id, status: affiliatesTable.status, refCode: affiliatesTable.refCode })
    .from(affiliatesTable)
    .where(eq(affiliatesTable.refCode, ref));

  if (!affiliate) return res.status(404).json({ error: "Invalid ref code" });
  if (affiliate.status !== "active") return res.status(400).json({ error: "Affiliate not active" });

  const [product] = await db
    .select({ id: productsTable.id, slug: productsTable.slug, name: productsTable.name, landingPageUrl: productsTable.landingPageUrl, websiteUrl: productsTable.websiteUrl })
    .from(productsTable)
    .where(eq(productsTable.slug, productSlug));

  if (!product) return res.status(404).json({ error: "Product not found" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || null;

  await db.insert(referralEventsTable).values({
    affiliateId: affiliate.id,
    refCode: ref,
    appName: productSlug,
    eventType: "click",
    ipAddress: ip,
    productId: product.id,
    productSlug: product.slug,
  }).catch(() => {});

  return res.json({
    ok: true,
    redirectUrl: product.landingPageUrl || product.websiteUrl,
  });
});

export default router;

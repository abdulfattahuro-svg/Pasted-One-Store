import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { offerApiKeysTable } from "@workspace/db";

const router = Router();

async function resolveApiKey(req: Parameters<Parameters<typeof router.use>[0]>[0], res: Parameters<Parameters<typeof router.use>[0]>[1]): Promise<{ offerId: number; offerSlug: string; offerName: string } | null> {
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

  return res.status(202).json({
    ok: true,
    message: "Lead received.",
    offerId: offer.offerId,
    offerSlug: offer.offerSlug,
    offerName: offer.offerName,
  });
});

export default router;

import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { db, productsTable, productAssetsTable } from "@workspace/db";
import { offerApiKeysTable } from "@workspace/db";

const router = Router();

const VALID_CATEGORIES = ["software", "mobile_app", "pwa", "course", "ebook", "subscription", "consulting", "physical_product", "event", "offline_service", "custom"] as const;
const VALID_COMMISSION_TYPES = ["fixed", "percentage", "recurring", "hybrid"] as const;
const VALID_ASSET_TYPES = ["image", "video", "pdf", "flyer", "banner", "social_post"] as const;

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    commissionValue: p.commissionValue !== null ? Number(p.commissionValue) : null,
    recurringPercentage: p.recurringPercentage !== null ? Number(p.recurringPercentage) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function formatAsset(a: typeof productAssetsTable.$inferSelect) {
  return { ...a, createdAt: a.createdAt.toISOString() };
}

router.get("/products", async (_req, res) => {
  const rows = await db.select().from(productsTable).orderBy(productsTable.createdAt);
  return res.json(rows.map(formatProduct));
});

// Public lookup by slug — used by the /product/:slug redirect page
router.get("/products/by-slug/:slug", async (req, res) => {
  const slug = req.params.slug?.toLowerCase();
  if (!slug) return res.status(400).json({ error: "Missing slug" });
  const [row] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!row) return res.status(404).json({ error: "Product not found" });
  return res.json(formatProduct(row));
});

router.post("/products", async (req, res) => {
  const {
    name, slug, description, websiteUrl, landingPageUrl, promoText,
    imageUrls, videoUrl, active, category,
    commissionType, commissionValue, recurringEnabled, recurringPercentage, holdPeriodDays,
    excludeFromLeaderboard,
  } = req.body as {
    name?: string; slug?: string; description?: string; websiteUrl?: string;
    landingPageUrl?: string; promoText?: string; imageUrls?: string[];
    videoUrl?: string; active?: boolean; category?: string;
    commissionType?: string; commissionValue?: number; recurringEnabled?: boolean;
    recurringPercentage?: number; holdPeriodDays?: number;
    excludeFromLeaderboard?: boolean;
  };

  if (!name || !slug || !websiteUrl) {
    return res.status(400).json({ error: "name, slug, and websiteUrl are required" });
  }
  if (category && !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return res.status(400).json({ error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(", ")}` });
  }
  if (commissionType && !VALID_COMMISSION_TYPES.includes(commissionType as typeof VALID_COMMISSION_TYPES[number])) {
    return res.status(400).json({ error: `Invalid commissionType. Valid values: ${VALID_COMMISSION_TYPES.join(", ")}` });
  }

  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const [row] = await db.insert(productsTable).values({
    name,
    slug: normalized,
    description: description ?? null,
    websiteUrl,
    landingPageUrl: landingPageUrl ?? null,
    promoText: promoText ?? null,
    imageUrls: imageUrls ?? [],
    videoUrl: videoUrl ?? null,
    active: active ?? true,
    category: category ?? "pwa",
    commissionType: commissionType ?? null,
    commissionValue: commissionValue !== undefined ? String(commissionValue) : null,
    recurringEnabled: recurringEnabled ?? false,
    recurringPercentage: recurringPercentage !== undefined ? String(recurringPercentage) : null,
    holdPeriodDays: holdPeriodDays ?? null,
    excludeFromLeaderboard: excludeFromLeaderboard ?? false,
  }).returning();

  return res.status(201).json(formatProduct(row));
});

router.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!row) return res.status(404).json({ error: "Product not found" });
  return res.json(formatProduct(row));
});

router.patch("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const {
    name, slug, description, websiteUrl, landingPageUrl, promoText,
    imageUrls, videoUrl, active, category,
    commissionType, commissionValue, recurringEnabled, recurringPercentage, holdPeriodDays,
    excludeFromLeaderboard,
  } = req.body as {
    name?: string; slug?: string; description?: string; websiteUrl?: string;
    landingPageUrl?: string; promoText?: string; imageUrls?: string[];
    videoUrl?: string; active?: boolean; category?: string;
    commissionType?: string | null; commissionValue?: number | null;
    recurringEnabled?: boolean; recurringPercentage?: number | null; holdPeriodDays?: number | null;
    excludeFromLeaderboard?: boolean;
  };

  if (category !== undefined && !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return res.status(400).json({ error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(", ")}` });
  }
  if (commissionType !== undefined && commissionType !== null && !VALID_COMMISSION_TYPES.includes(commissionType as typeof VALID_COMMISSION_TYPES[number])) {
    return res.status(400).json({ error: `Invalid commissionType. Valid values: ${VALID_COMMISSION_TYPES.join(", ")}` });
  }

  const updates: Partial<typeof productsTable.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (description !== undefined) updates.description = description;
  if (websiteUrl !== undefined) updates.websiteUrl = websiteUrl;
  if (landingPageUrl !== undefined) updates.landingPageUrl = landingPageUrl;
  if (promoText !== undefined) updates.promoText = promoText;
  if (imageUrls !== undefined) updates.imageUrls = imageUrls;
  if (videoUrl !== undefined) updates.videoUrl = videoUrl;
  if (active !== undefined) updates.active = active;
  if (category !== undefined) updates.category = category;
  if (commissionType !== undefined) updates.commissionType = commissionType;
  if (commissionValue !== undefined) updates.commissionValue = commissionValue !== null ? String(commissionValue) : null;
  if (recurringEnabled !== undefined) updates.recurringEnabled = recurringEnabled;
  if (recurringPercentage !== undefined) updates.recurringPercentage = recurringPercentage !== null ? String(recurringPercentage) : null;
  if (holdPeriodDays !== undefined) updates.holdPeriodDays = holdPeriodDays;
  if (excludeFromLeaderboard !== undefined) updates.excludeFromLeaderboard = excludeFromLeaderboard;

  const [row] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Product not found" });
  return res.json(formatProduct(row));
});

router.delete("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(productsTable).where(eq(productsTable.id, id));
  return res.json({ ok: true });
});

router.get("/products/:id/assets", async (req, res) => {
  const productId = Number(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(productAssetsTable).where(eq(productAssetsTable.productId, productId));
  return res.json(rows.map(formatAsset));
});

router.post("/products/:id/assets", async (req, res) => {
  const productId = Number(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid id" });

  const { type, title, fileUrl } = req.body as { type?: string; title?: string; fileUrl?: string };
  if (!title || !fileUrl) return res.status(400).json({ error: "title and fileUrl are required" });
  if (type && !VALID_ASSET_TYPES.includes(type as typeof VALID_ASSET_TYPES[number])) {
    return res.status(400).json({ error: `Invalid type. Valid values: ${VALID_ASSET_TYPES.join(", ")}` });
  }

  const [row] = await db.insert(productAssetsTable).values({
    productId,
    type: (type ?? "image") as typeof VALID_ASSET_TYPES[number],
    title,
    fileUrl,
  }).returning();

  return res.status(201).json(formatAsset(row));
});

router.delete("/products/:id/assets/:assetId", async (req, res) => {
  const assetId = Number(req.params.assetId);
  if (isNaN(assetId)) return res.status(400).json({ error: "Invalid assetId" });
  await db.delete(productAssetsTable).where(eq(productAssetsTable.id, assetId));
  return res.json({ ok: true });
});

const VALID_ENVS = ["production", "staging", "development"] as const;

function generateApiKey(): string {
  return "sk_" + crypto.randomBytes(32).toString("hex");
}

function maskApiKey(key: string): string {
  if (key.length <= 10) return "****";
  return key.slice(0, 10) + "..." + key.slice(-4);
}

function formatApiKey(row: typeof offerApiKeysTable.$inferSelect, showFull = false) {
  return {
    ...row,
    apiKey: showFull ? row.apiKey : maskApiKey(row.apiKey),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

router.get("/products/:id/api-keys", async (req, res) => {
  const productId = Number(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid id" });
  const rows = await db
    .select()
    .from(offerApiKeysTable)
    .where(eq(offerApiKeysTable.offerId, productId))
    .orderBy(desc(offerApiKeysTable.createdAt));
  return res.json(rows.map(r => formatApiKey(r)));
});

router.post("/products/:id/api-keys", async (req, res) => {
  const productId = Number(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid id" });

  const { name, environment } = req.body as { name?: string; environment?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const env = (environment ?? "production") as typeof VALID_ENVS[number];
  if (!VALID_ENVS.includes(env)) {
    return res.status(400).json({ error: `Invalid environment. Must be: ${VALID_ENVS.join(", ")}` });
  }

  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return res.status(404).json({ error: "Offer not found" });

  const rawKey = generateApiKey();
  const [row] = await db.insert(offerApiKeysTable).values({
    offerId: productId,
    name: name.trim(),
    apiKey: rawKey,
    environment: env,
    status: "active",
  }).returning();

  return res.status(201).json(formatApiKey(row, true));
});

router.patch("/products/:id/api-keys/:keyId", async (req, res) => {
  const keyId = Number(req.params.keyId);
  if (isNaN(keyId)) return res.status(400).json({ error: "Invalid keyId" });

  const { status, name } = req.body as { status?: string; name?: string };
  const updates: Partial<typeof offerApiKeysTable.$inferInsert> = {};
  if (status !== undefined) {
    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ error: "status must be 'active' or 'disabled'" });
    }
    updates.status = status;
  }
  if (name !== undefined) updates.name = name.trim();

  const [row] = await db.update(offerApiKeysTable).set(updates).where(eq(offerApiKeysTable.id, keyId)).returning();
  if (!row) return res.status(404).json({ error: "API key not found" });
  return res.json(formatApiKey(row));
});

router.delete("/products/:id/api-keys/:keyId", async (req, res) => {
  const keyId = Number(req.params.keyId);
  if (isNaN(keyId)) return res.status(400).json({ error: "Invalid keyId" });
  await db.delete(offerApiKeysTable).where(eq(offerApiKeysTable.id, keyId));
  return res.json({ ok: true });
});

router.post("/products/:id/api-keys/:keyId/regenerate", async (req, res) => {
  const keyId = Number(req.params.keyId);
  if (isNaN(keyId)) return res.status(400).json({ error: "Invalid keyId" });

  const rawKey = generateApiKey();
  const [row] = await db.update(offerApiKeysTable).set({ apiKey: rawKey }).where(eq(offerApiKeysTable.id, keyId)).returning();
  if (!row) return res.status(404).json({ error: "API key not found" });
  return res.json(formatApiKey(row, true));
});

export default router;

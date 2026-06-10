import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, appsTable } from "@workspace/db";

const router = Router();

function formatApp(a: typeof appsTable.$inferSelect) {
  return { ...a, createdAt: a.createdAt.toISOString() };
}

router.get("/apps", async (_req, res) => {
  const rows = await db.select().from(appsTable).orderBy(appsTable.createdAt);
  return res.json(rows.map(formatApp));
});

router.post("/apps", async (req, res) => {
  const { name, slug, description, websiteUrl, promoText, imageUrls, videoUrl } = req.body as {
    name?: string; slug?: string; description?: string; websiteUrl?: string;
    promoText?: string; imageUrls?: string[]; videoUrl?: string;
  };

  if (!name || !slug || !websiteUrl) {
    return res.status(400).json({ error: "name, slug, and websiteUrl are required" });
  }

  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const [row] = await db.insert(appsTable).values({
    name, slug: normalized, description: description ?? null,
    websiteUrl, promoText: promoText ?? null,
    imageUrls: imageUrls ?? [],
    videoUrl: videoUrl ?? null,
    active: true,
  }).returning();

  return res.status(201).json(formatApp(row));
});

router.get("/apps/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.select().from(appsTable).where(eq(appsTable.id, id));
  if (!row) return res.status(404).json({ error: "App not found" });
  return res.json(formatApp(row));
});

router.patch("/apps/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { name, slug, description, websiteUrl, promoText, imageUrls, videoUrl, active } = req.body as {
    name?: string; slug?: string; description?: string; websiteUrl?: string;
    promoText?: string; imageUrls?: string[]; videoUrl?: string; active?: boolean;
  };

  const updates: Partial<typeof appsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (description !== undefined) updates.description = description;
  if (websiteUrl !== undefined) updates.websiteUrl = websiteUrl;
  if (promoText !== undefined) updates.promoText = promoText;
  if (imageUrls !== undefined) updates.imageUrls = imageUrls;
  if (videoUrl !== undefined) updates.videoUrl = videoUrl;
  if (active !== undefined) updates.active = active;

  const [row] = await db.update(appsTable).set(updates).where(eq(appsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "App not found" });
  return res.json(formatApp(row));
});

router.delete("/apps/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(appsTable).where(eq(appsTable.id, id));
  return res.json({ ok: true });
});

export default router;

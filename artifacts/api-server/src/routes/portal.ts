import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, affiliatesTable } from "@workspace/db";

const router = Router();

function safeAffiliate(row: typeof affiliatesTable.$inferSelect) {
  const { passwordHash: _ph, ...safe } = row;
  return { ...safe, createdAt: row.createdAt.toISOString() };
}

router.post("/portal/signup", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate) {
    return res.status(404).json({ error: "No affiliate account found for this email. Contact your partner manager." });
  }
  if (affiliate.status === "suspended") {
    return res.status(403).json({ error: "This account has been suspended." });
  }
  if (affiliate.passwordHash) {
    return res.status(409).json({ error: "Account already set up. Please log in instead." });
  }

  const hash = await bcrypt.hash(password, 12);
  await db.update(affiliatesTable).set({ passwordHash: hash }).where(eq(affiliatesTable.id, affiliate.id));

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

router.post("/portal/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email.toLowerCase().trim()));
  if (!affiliate || !affiliate.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (affiliate.status === "suspended") {
    return res.status(403).json({ error: "This account has been suspended." });
  }

  const valid = await bcrypt.compare(password, affiliate.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  req.session.affiliateId = affiliate.id;
  return res.json(safeAffiliate(affiliate));
});

router.post("/portal/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get("/portal/me", async (req, res) => {
  const affiliateId = req.session?.affiliateId;
  if (!affiliateId) return res.status(401).json({ error: "Not authenticated" });

  const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId));
  if (!affiliate) return res.status(401).json({ error: "Not authenticated" });

  return res.json(safeAffiliate(affiliate));
});

export default router;

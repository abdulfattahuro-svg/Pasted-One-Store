import { pgTable, serial, varchar, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const affiliateStatusEnum = pgEnum("affiliate_status", ["active", "suspended"]);
export const signupStatusEnum = pgEnum("signup_status", ["pending_verification", "pending_approval", "active", "rejected"]);

export const affiliatesTable = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  refCode: varchar("ref_code", { length: 50 }).notNull().unique(),
  status: affiliateStatusEnum("status").notNull().default("active"),
  passwordHash: varchar("password_hash", { length: 255 }),
  // Self-signup flow
  isSelfSignup: boolean("is_self_signup").notNull().default(false),
  signupStatus: signupStatusEnum("signup_status"),
  verificationToken: varchar("verification_token", { length: 128 }),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  welcomedAt: timestamp("welcomed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAffiliateSchema = createInsertSchema(affiliatesTable).omit({ id: true, createdAt: true, refCode: true });
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Affiliate = typeof affiliatesTable.$inferSelect;

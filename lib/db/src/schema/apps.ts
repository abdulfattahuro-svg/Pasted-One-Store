import { pgTable, serial, varchar, text, boolean, timestamp, decimal, integer } from "drizzle-orm/pg-core";

export const productsTable = pgTable("apps", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  websiteUrl: varchar("website_url", { length: 500 }).notNull(),
  landingPageUrl: varchar("landing_page_url", { length: 500 }),
  promoText: text("promo_text"),
  imageUrls: text("image_urls").array().notNull().default([]),
  videoUrl: varchar("video_url", { length: 500 }),
  active: boolean("active").notNull().default(true),
  category: varchar("category", { length: 50 }).notNull().default("pwa"),
  commissionType: varchar("commission_type", { length: 20 }),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }),
  recurringEnabled: boolean("recurring_enabled").notNull().default(false),
  recurringPercentage: decimal("recurring_percentage", { precision: 5, scale: 2 }),
  holdPeriodDays: integer("hold_period_days"),
  // Leaderboard: exclude this product's stats from the ranking calculation
  excludeFromLeaderboard: boolean("exclude_from_leaderboard").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const appsTable = productsTable;

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
export type App = Product;
export type InsertApp = InsertProduct;

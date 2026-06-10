import { pgTable, serial, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const appsTable = pgTable("apps", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  websiteUrl: varchar("website_url", { length: 500 }).notNull(),
  promoText: text("promo_text"),
  imageUrls: text("image_urls").array().notNull().default([]),
  videoUrl: varchar("video_url", { length: 500 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type App = typeof appsTable.$inferSelect;
export type InsertApp = typeof appsTable.$inferInsert;

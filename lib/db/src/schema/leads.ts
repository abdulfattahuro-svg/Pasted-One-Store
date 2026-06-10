import { pgTable, serial, integer, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";
import { productsTable } from "./apps";

export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "interested", "won", "lost"]);
export const leadSourceEnum = pgEnum("lead_source", ["affiliate_submission", "website_form", "api", "import"]);

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id),
  affiliateCode: varchar("affiliate_code", { length: 50 }).notNull(),
  productSlug: varchar("product_slug", { length: 100 }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  status: leadStatusEnum("status").notNull().default("new"),
  source: leadSourceEnum("source").notNull().default("affiliate_submission"),
  approvedAt: timestamp("approved_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;

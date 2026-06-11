import { pgTable, serial, integer, varchar, text, timestamp, pgEnum, json, numeric } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";
import { productsTable } from "./apps";

export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "interested", "approved", "won", "lost", "rejected"]);
export const leadSourceEnum = pgEnum("lead_source", ["affiliate_submission", "website_form", "api", "import"]);

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id),
  affiliateCode: varchar("affiliate_code", { length: 50 }).notNull(),
  productSlug: varchar("product_slug", { length: 100 }),
  offerName: varchar("offer_name", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  status: leadStatusEnum("status").notNull().default("new"),
  source: leadSourceEnum("source").notNull().default("affiliate_submission"),
  // Deal value tracking
  expectedValue: numeric("expected_value", { precision: 15, scale: 2 }),
  closedDealValue: numeric("closed_deal_value", { precision: 15, scale: 2 }),
  actualRevenue: numeric("actual_revenue", { precision: 15, scale: 2 }),
  payoutAmount: numeric("payout_amount", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  // Status timestamps
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 255 }),
  rejectedAt: timestamp("rejected_at"),
  rejectedReason: text("rejected_reason"),
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  convertedAt: timestamp("converted_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;

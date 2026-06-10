import { pgTable, serial, integer, varchar, decimal, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";
import { productsTable } from "./apps";

export const conversionStatusEnum = pgEnum("conversion_status", ["HOLD", "PAYABLE", "PAID"]);

export const conversionsTable = pgTable("conversions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id),
  userId: varchar("user_id", { length: 255 }).notNull(),
  appName: varchar("app_name", { length: 100 }).notNull(),
  paymentId: varchar("payment_id", { length: 255 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull(),
  status: conversionStatusEnum("status").notNull().default("HOLD"),
  conversionDate: timestamp("conversion_date").notNull().defaultNow(),
  holdEndDate: timestamp("hold_end_date").notNull(),
  // Product-level tracking
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productSlug: varchar("product_slug", { length: 100 }),
  // Future compatibility: lead, purchase, renewal, offline, webhook, api
  conversionType: varchar("conversion_type", { length: 50 }).notNull().default("payment"),
  // Source of the conversion: api, webhook, manual, offline
  source: varchar("source", { length: 50 }).notNull().default("api"),
});

export type Conversion = typeof conversionsTable.$inferSelect;

import { pgTable, serial, integer, decimal, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";

export const payoutStatusEnum = pgEnum("payout_status", ["PENDING", "PAID"]);

export const payoutsTable = pgTable("payouts", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: payoutStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export type Payout = typeof payoutsTable.$inferSelect;

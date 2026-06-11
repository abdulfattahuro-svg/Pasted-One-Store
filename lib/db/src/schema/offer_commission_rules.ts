import { pgTable, serial, integer, varchar, decimal, boolean, timestamp } from "drizzle-orm/pg-core";

export const offerCommissionRulesTable = pgTable("offer_commission_rules", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  triggerEvent: varchar("trigger_event", { length: 50 }).notNull(),
  commissionType: varchar("commission_type", { length: 20 }).notNull().default("fixed"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).notNull().default("0"),
  recurringEnabled: boolean("recurring_enabled").notNull().default(false),
  recurringPercentage: decimal("recurring_percentage", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OfferCommissionRule = typeof offerCommissionRulesTable.$inferSelect;

export const TRIGGER_EVENTS = [
  "lead_submitted",
  "lead_approved",
  "deal_won",
  "signup",
  "purchase",
  "renewal",
  "upgrade",
] as const;

export type TriggerEvent = typeof TRIGGER_EVENTS[number];

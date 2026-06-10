import { pgTable, serial, varchar, decimal, integer } from "drizzle-orm/pg-core";

export const systemConfigTable = pgTable("system_config", {
  id: serial("id").primaryKey(),
  commissionType: varchar("commission_type", { length: 20 }).notNull().default("fixed"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).notNull().default("500"),
  holdDays: integer("hold_days").notNull().default(14),
  apiKey: varchar("api_key", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
});

export type SystemConfig = typeof systemConfigTable.$inferSelect;

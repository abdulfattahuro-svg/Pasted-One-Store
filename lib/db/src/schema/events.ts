import { pgTable, serial, integer, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";

export const eventTypeEnum = pgEnum("event_type", ["click", "signup"]);

export const referralEventsTable = pgTable("referral_events", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id),
  refCode: varchar("ref_code", { length: 50 }).notNull(),
  appName: varchar("app_name", { length: 100 }).notNull(),
  eventType: eventTypeEnum("event_type").notNull(),
  userId: varchar("user_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ReferralEvent = typeof referralEventsTable.$inferSelect;

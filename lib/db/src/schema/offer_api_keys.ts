import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";

export const offerApiKeysTable = pgTable("offer_api_keys", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  apiKey: varchar("api_key", { length: 128 }).notNull().unique(),
  environment: varchar("environment", { length: 32 }).notNull().default("production"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

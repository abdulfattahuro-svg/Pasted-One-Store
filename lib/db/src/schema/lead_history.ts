import { pgTable, serial, integer, varchar, text, json, timestamp } from "drizzle-orm/pg-core";

export const leadHistoryTable = pgTable("lead_history", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  changedBy: varchar("changed_by", { length: 255 }),
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }).notNull(),
  notes: text("notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeadHistory = typeof leadHistoryTable.$inferSelect;

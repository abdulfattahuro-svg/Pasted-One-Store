import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;

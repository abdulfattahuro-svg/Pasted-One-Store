import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  name: varchar("name", { length: 100 }).primaryKey(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;

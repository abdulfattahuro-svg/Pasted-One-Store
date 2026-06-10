import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { affiliatesTable } from "./affiliates";

export const onboardingResponsesTable = pgTable("onboarding_responses", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id, { onDelete: "cascade" }),
  questionKey: varchar("question_key", { length: 100 }).notNull(),
  question: varchar("question", { length: 500 }).notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OnboardingResponse = typeof onboardingResponsesTable.$inferSelect;

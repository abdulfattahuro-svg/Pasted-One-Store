import { pgTable, serial, varchar, decimal, integer, text } from "drizzle-orm/pg-core";

export const systemConfigTable = pgTable("system_config", {
  id: serial("id").primaryKey(),
  commissionType: varchar("commission_type", { length: 20 }).notNull().default("fixed"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).notNull().default("500"),
  holdDays: integer("hold_days").notNull().default(14),
  apiKey: varchar("api_key", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),

  // Affiliate approval
  approvalMode: varchar("approval_mode", { length: 20 }).notNull().default("auto"),

  // Email delivery
  emailProvider: varchar("email_provider", { length: 20 }).notNull().default("console"),
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: varchar("smtp_pass", { length: 255 }),
  smtpFrom: varchar("smtp_from", { length: 255 }),
  resendApiKey: varchar("resend_api_key", { length: 255 }),

  // Program info (shown in onboarding modal)
  programName: varchar("program_name", { length: 255 }).default("OneStore Affiliate Program"),
  programTagline: text("program_tagline").default("Earn real money sharing apps you believe in."),
  commissionHighlight: varchar("commission_highlight", { length: 255 }).default("Earn up to $500 per referral"),
  programDetails: text("program_details").default("Join hundreds of affiliates earning passive income every month. No experience needed — just share your link and watch your earnings grow."),
});

export type SystemConfig = typeof systemConfigTable.$inferSelect;

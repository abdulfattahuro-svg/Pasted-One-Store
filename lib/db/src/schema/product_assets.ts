import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./apps";

export const productAssetsTable = pgTable("product_assets", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull().default("image"),
  title: varchar("title", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProductAsset = typeof productAssetsTable.$inferSelect;
export type InsertProductAsset = typeof productAssetsTable.$inferInsert;

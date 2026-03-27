import { pgTable, serial, text, jsonb, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export type PrizeTemplateLevels = { position: number; percentage: number }[];

export const prizeTemplates = pgTable("prize_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  levels: jsonb("levels").$type<PrizeTemplateLevels>().notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

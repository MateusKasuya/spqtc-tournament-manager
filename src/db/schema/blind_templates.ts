import { pgTable, serial, text, jsonb, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export type BlindTemplateLevels = {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
  isBreak: boolean;
  isAddonLevel: boolean;
  isBigAnte: boolean;
}[];

export const blindTemplates = pgTable("blind_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  levels: jsonb("levels").$type<BlindTemplateLevels>().notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

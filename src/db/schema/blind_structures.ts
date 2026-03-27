import { pgTable, serial, integer, boolean, unique } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

export const blindStructures = pgTable("blind_structures", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  level: integer("level").notNull(),
  smallBlind: integer("small_blind").notNull(),
  bigBlind: integer("big_blind").notNull(),
  ante: integer("ante").notNull().default(0),
  durationMinutes: integer("duration_minutes").notNull(),
  isBreak: boolean("is_break").notNull().default(false),
  isAddonLevel: boolean("is_addon_level").notNull().default(false),
  isBigAnte: boolean("is_big_ante").notNull().default(false),
}, (table) => [
  unique().on(table.tournamentId, table.level),
]);

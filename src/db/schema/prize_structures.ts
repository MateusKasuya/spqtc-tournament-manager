import { pgTable, serial, integer, numeric, unique } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

export const prizeStructures = pgTable("prize_structures", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  position: integer("position").notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
}, (table) => [
  unique().on(table.tournamentId, table.position),
]);

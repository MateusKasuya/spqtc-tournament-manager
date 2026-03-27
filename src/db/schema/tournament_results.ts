import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

export const tournamentResults = pgTable("tournament_results", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  position: integer("position").notNull(),
  amountPaid: integer("amount_paid").notNull(),
  notes: text("notes"),
});

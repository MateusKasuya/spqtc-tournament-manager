import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";
import { players } from "./players";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  playerId: integer("player_id")
    .references(() => players.id)
    .notNull(),
  type: text("type", {
    enum: ["buy_in", "rebuy", "addon", "prize"],
  }).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

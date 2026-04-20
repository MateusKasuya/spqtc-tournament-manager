import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";
import { players } from "./players";
import { participants } from "./participants";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  playerId: integer("player_id")
    .references(() => players.id)
    .notNull(),
  type: text("type", {
    enum: ["buy_in", "rebuy", "addon", "prize", "bounty_earned"],
  }).notNull(),
  amount: integer("amount").notNull(),
  bountyChange: integer("bounty_change").notNull().default(0),
  relatedParticipantId: integer("related_participant_id").references(() => participants.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

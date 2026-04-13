import { pgTable, serial, integer, text, boolean, timestamp, numeric, unique } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";
import { players } from "./players";

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  playerId: integer("player_id")
    .references(() => players.id)
    .notNull(),
  buyInPaid: boolean("buy_in_paid").notNull().default(false),
  rebuyCount: integer("rebuy_count").notNull().default(0),
  addonUsed: boolean("addon_used").notNull().default(false),
  bonusChipUsed: boolean("bonus_chip_used").notNull().default(false),
  finishPosition: integer("finish_position"),
  pointsEarned: numeric("points_earned", { precision: 10, scale: 2 }).notNull().default("0"),
  prizeAmount: integer("prize_amount").notNull().default(0),
  eliminatedAt: timestamp("eliminated_at", { withTimezone: true }),
  status: text("status", {
    enum: ["registered", "playing", "eliminated", "finished"],
  }).notNull().default("registered"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.tournamentId, table.playerId),
]);

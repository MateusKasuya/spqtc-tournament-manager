import { pgTable, serial, integer, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { seasons } from "./seasons";
import { users } from "./users";

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  tournamentType: text("tournament_type", { enum: ["normal", "bounty_builder"] }).notNull().default("normal"),
  bountyPercentage: integer("bounty_percentage").notNull().default(50),
  seasonId: integer("season_id").references(() => seasons.id),
  name: text("name").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "finished", "cancelled"],
  }).notNull().default("pending"),
  buyInAmount: integer("buy_in_amount").notNull(),
  rebuyAmount: integer("rebuy_amount").notNull().default(0),
  addonAmount: integer("addon_amount").notNull().default(0),
  initialChips: integer("initial_chips").notNull(),
  rebuyChips: integer("rebuy_chips").notNull().default(0),
  addonChips: integer("addon_chips").notNull().default(0),
  bonusChipAmount: integer("bonus_chip_amount").notNull().default(0),
  maxRebuys: integer("max_rebuys").notNull().default(0),
  allowAddon: boolean("allow_addon").notNull().default(false),
  prizePoolOverride: integer("prize_pool_override"),
  rankingFeeAmount: integer("ranking_fee_amount").notNull().default(0),
  currentBlindLevel: integer("current_blind_level").notNull().default(0),
  timerRunning: boolean("timer_running").notNull().default(false),
  timerRemainingSecs: integer("timer_remaining_secs"),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  breakActive: boolean("break_active").notNull().default(false),
  levelRemainingSecs: integer("level_remaining_secs"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

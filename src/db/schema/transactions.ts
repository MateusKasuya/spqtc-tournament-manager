import { pgTable, serial, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";
import { users } from "./users";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  type: text("type", {
    enum: ["buy_in", "rebuy", "addon", "prize"],
  }).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

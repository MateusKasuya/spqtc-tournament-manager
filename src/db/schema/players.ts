import { pgTable, serial, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname").unique(),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

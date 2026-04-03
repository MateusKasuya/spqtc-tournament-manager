import { db } from "@/db";
import { players } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function getAllPlayers() {
  return db
    .select({
      id: players.id,
      name: players.name,
      nickname: players.nickname,
    })
    .from(players)
    .orderBy(asc(players.name));
}

export async function getPlayerById(id: number) {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, id));
  return player ?? null;
}

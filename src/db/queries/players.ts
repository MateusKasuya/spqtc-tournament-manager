import { db } from "@/db";
import { players } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const getAllPlayers = unstable_cache(
  async () => {
    return db
      .select({
        id: players.id,
        name: players.name,
        nickname: players.nickname,
      })
      .from(players)
      .orderBy(asc(players.name));
  },
  ["all-players"],
  { revalidate: 300, tags: ["players"] }
);

export async function getPlayerById(id: number) {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, id));
  return player ?? null;
}

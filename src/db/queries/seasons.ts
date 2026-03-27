import { db } from "@/db";
import { seasons } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getSeasons() {
  return db.select().from(seasons).orderBy(desc(seasons.createdAt));
}

export async function getActiveSeason() {
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  return season ?? null;
}

export async function getSeasonById(id: number) {
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, id));
  return season ?? null;
}

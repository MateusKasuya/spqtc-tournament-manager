import { db } from "@/db";
import { prizeTemplates } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getPrizeTemplates() {
  return db
    .select({ id: prizeTemplates.id, name: prizeTemplates.name, levels: prizeTemplates.levels })
    .from(prizeTemplates)
    .orderBy(desc(prizeTemplates.createdAt));
}

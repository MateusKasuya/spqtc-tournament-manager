import { db } from "@/db";
import { blindTemplates } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getBlindTemplates() {
  return db
    .select({
      id: blindTemplates.id,
      name: blindTemplates.name,
      levels: blindTemplates.levels,
    })
    .from(blindTemplates)
    .orderBy(desc(blindTemplates.createdAt));
}

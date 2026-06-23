"use server";

import { requireAdmin } from "@/lib/require-admin";
import { db } from "@/db";
import { prizeTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PrizeTemplateLevels } from "@/db/schema";

export async function savePrizeTemplate(name: string, levels: PrizeTemplateLevels) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  if (!name.trim()) return { error: "Nome obrigatorio" };

  const levelsSchema = z
    .array(
      z.object({
        position: z.number().int().positive(),
        percentage: z.number().min(0).max(100),
      })
    )
    .min(1);
  const parsedLevels = levelsSchema.safeParse(levels);
  if (!parsedLevels.success) return { error: "Estrutura de premios invalida" };

  const [created] = await db.insert(prizeTemplates).values({
    name: name.trim(),
    levels: parsedLevels.data,
    createdBy: auth.user.id,
  }).returning({ id: prizeTemplates.id, name: prizeTemplates.name, levels: prizeTemplates.levels });

  revalidatePath("/torneios");
  return { success: true, template: created };
}

export async function deletePrizeTemplate(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await db.delete(prizeTemplates).where(eq(prizeTemplates.id, id));
  revalidatePath("/torneios");
  return { success: true };
}

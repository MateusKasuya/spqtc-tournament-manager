"use server";

import { requireAdmin } from "@/lib/require-admin";
import { db } from "@/db";
import { blindTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { BlindTemplateLevels } from "@/db/schema";
import { z } from "zod";

const blindLevelsSchema = z
  .array(
    z.object({
      level: z.number().int(),
      smallBlind: z.number().int().nonnegative(),
      bigBlind: z.number().int().nonnegative(),
      ante: z.number().int().nonnegative(),
      durationMinutes: z.number().int().positive(),
      isBreak: z.boolean(),
      isAddonLevel: z.boolean(),
      isBigAnte: z.boolean(),
    })
  )
  .min(1, "Estrutura de blinds invalida");

export async function saveBlindTemplate(name: string, levels: BlindTemplateLevels) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  if (!name.trim()) return { error: "Nome obrigatorio" };

  const parsed = blindLevelsSchema.safeParse(levels);
  if (!parsed.success) return { error: "Estrutura de blinds invalida" };

  const [created] = await db.insert(blindTemplates).values({
    name: name.trim(),
    levels: parsed.data,
    createdBy: auth.user.id,
  }).returning({ id: blindTemplates.id, name: blindTemplates.name, levels: blindTemplates.levels });

  revalidatePath("/torneios");
  return { success: true, template: created };
}

export async function deleteBlindTemplate(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(blindTemplates).where(eq(blindTemplates.id, id));

  revalidatePath("/torneios");
  return { success: true };
}

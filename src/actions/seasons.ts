"use server";

import { requireAdmin } from "@/lib/require-admin";
import { db } from "@/db";
import { seasons, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const seasonSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  startDate: z.string().min(1, "Data de inicio obrigatoria"),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function createSeason(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = seasonSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.transaction(async (tx) => {
    if (parsed.data.isActive) {
      await tx.update(seasons).set({ isActive: false });
    }
    await tx.insert(seasons).values({
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate || null,
      isActive: parsed.data.isActive,
    });
  });

  revalidatePath("/torneios");
  return { success: "Temporada criada!" };
}

export async function deleteSeason(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const linked = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.seasonId, id))
    .limit(1);

  if (linked.length > 0) {
    return { error: "Temporada possui torneios vinculados e nao pode ser excluida" };
  }

  await db.delete(seasons).where(eq(seasons.id, id));

  revalidatePath("/torneios");
  revalidatePath("/temporadas");
  return { success: "Temporada excluida!" };
}

export async function toggleSeasonActive(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.transaction(async (tx) => {
    await tx.update(seasons).set({ isActive: false });
    await tx.update(seasons).set({ isActive: true }).where(eq(seasons.id, id));
  });

  revalidatePath("/temporadas");
  revalidatePath("/ranking");
  revalidatePath("/torneios");
  return { success: "Temporada ativada!" };
}

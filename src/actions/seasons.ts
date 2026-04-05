"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const seasonSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  startDate: z.string().min(1, "Data de inicio obrigatoria"),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Apenas admins podem fazer isso" };
  return { user };
}

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

  await db.insert(seasons).values({
    name: parsed.data.name,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate || null,
    isActive: parsed.data.isActive,
  });

  revalidatePath("/torneios");
  return { success: "Temporada criada!" };
}

export async function updateSeason(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = seasonSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(seasons)
    .set({
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate || null,
      isActive: parsed.data.isActive,
    })
    .where(eq(seasons.id, id));

  revalidatePath("/torneios");
  return { success: "Temporada atualizada!" };
}

export async function deleteSeason(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(seasons).where(eq(seasons.id, id));

  revalidatePath("/torneios");
  revalidatePath("/temporadas");
  return { success: "Temporada excluida!" };
}

export async function toggleSeasonActive(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.update(seasons).set({ isActive: false });
  await db.update(seasons).set({ isActive: true }).where(eq(seasons.id, id));

  revalidatePath("/temporadas");
  revalidatePath("/ranking");
  revalidatePath("/torneios");
  return { success: "Temporada ativada!" };
}

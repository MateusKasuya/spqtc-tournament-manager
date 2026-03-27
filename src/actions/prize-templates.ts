"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { prizeTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PrizeTemplateLevels } from "@/db/schema";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Apenas admins podem fazer isso" };
  return { user };
}

export async function savePrizeTemplate(name: string, levels: PrizeTemplateLevels) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  if (!name.trim()) return { error: "Nome obrigatorio" };

  const [created] = await db.insert(prizeTemplates).values({
    name: name.trim(),
    levels,
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

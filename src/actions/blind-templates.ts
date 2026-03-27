"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { blindTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { BlindTemplateLevels } from "@/db/schema";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Apenas admins podem fazer isso" };
  return { user };
}

export async function saveBlindTemplate(name: string, levels: BlindTemplateLevels) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  if (!name.trim()) return { error: "Nome obrigatorio" };

  const [created] = await db.insert(blindTemplates).values({
    name: name.trim(),
    levels,
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

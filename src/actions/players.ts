"use server";

import { db } from "@/db";
import { players, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function createPlayer(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = (formData.get("name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || null;

  if (!name || name.length < 2) return { error: "Nome deve ter pelo menos 2 caracteres" };

  await db.insert(players).values({ name, nickname });

  revalidatePath("/jogadores");
  return { success: true };
}

export async function updatePlayer(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = (formData.get("name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || null;

  if (!name || name.length < 2) return { error: "Nome deve ter pelo menos 2 caracteres" };

  await db.update(players).set({ name, nickname }).where(eq(players.id, id));

  revalidatePath("/jogadores");
  return { success: true };
}

export async function deletePlayer(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const existing = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.playerId, id))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Jogador possui torneios vinculados e nao pode ser removido" };
  }

  await db.delete(players).where(eq(players.id, id));

  revalidatePath("/jogadores");
  return { success: true };
}

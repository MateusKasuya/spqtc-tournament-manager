"use server";

import { db } from "@/db";
import { players, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === "23505";
}

export async function createPlayer(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = (formData.get("name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || null;

  if (!name || name.length < 2) return { error: "Nome deve ter pelo menos 2 caracteres" };

  try {
    await db.insert(players).values({ name, nickname });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Apelido ja esta em uso" };
    throw e;
  }

  revalidatePath("/jogadores");
  return { success: true };
}

export async function updatePlayer(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = (formData.get("name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || null;

  if (!name || name.length < 2) return { error: "Nome deve ter pelo menos 2 caracteres" };

  try {
    await db.update(players).set({ name, nickname }).where(eq(players.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Apelido ja esta em uso" };
    throw e;
  }

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

  try {
    await db.delete(players).where(eq(players.id, id));
  } catch (e) {
    console.error("deletePlayer failed", e);
    return { error: "Jogador possui torneios vinculados e nao pode ser removido" };
  }

  revalidatePath("/jogadores");
  return { success: true };
}

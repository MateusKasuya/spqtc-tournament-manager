"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tournaments, blindStructures, prizeStructures } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_BLIND_STRUCTURE } from "@/lib/tournament-defaults";

const tournamentSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  seasonId: z.number().nullable(),
  date: z.string().min(1, "Data obrigatoria"),
  buyInAmount: z.number().min(0, "Buy-in deve ser >= 0"),
  rebuyAmount: z.number().min(0).default(0),
  addonAmount: z.number().min(0).default(0),
  initialChips: z.number().min(1, "Fichas iniciais obrigatorias"),
  rebuyChips: z.number().min(0).default(0),
  addonChips: z.number().min(0).default(0),
  maxRebuys: z.number().min(0).default(0),
  allowAddon: z.boolean().default(false),
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

export async function createTournament(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const seasonIdRaw = formData.get("seasonId");
  const parsed = tournamentSchema.safeParse({
    name: formData.get("name"),
    seasonId: seasonIdRaw ? Number(seasonIdRaw) : null,
    date: formData.get("date"),
    buyInAmount: Number(formData.get("buyInAmount")),
    rebuyAmount: Number(formData.get("rebuyAmount") ?? 0),
    addonAmount: Number(formData.get("addonAmount") ?? 0),
    initialChips: Number(formData.get("initialChips")),
    rebuyChips: Number(formData.get("rebuyChips") ?? 0),
    addonChips: Number(formData.get("addonChips") ?? 0),
    maxRebuys: Number(formData.get("maxRebuys") ?? 0),
    allowAddon: formData.get("allowAddon") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [tournament] = await db
    .insert(tournaments)
    .values({
      ...parsed.data,
      date: new Date(parsed.data.date),
      createdBy: auth.user.id,
    })
    .returning({ id: tournaments.id });

  await db.insert(blindStructures).values(
    DEFAULT_BLIND_STRUCTURE.map((level) => ({
      tournamentId: tournament.id,
      ...level,
    }))
  );

  revalidatePath("/torneios");
  redirect(`/torneios/${tournament.id}`);
}

export async function updateTournament(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const seasonIdRaw = formData.get("seasonId");
  const parsed = tournamentSchema.safeParse({
    name: formData.get("name"),
    seasonId: seasonIdRaw ? Number(seasonIdRaw) : null,
    date: formData.get("date"),
    buyInAmount: Number(formData.get("buyInAmount")),
    rebuyAmount: Number(formData.get("rebuyAmount") ?? 0),
    addonAmount: Number(formData.get("addonAmount") ?? 0),
    initialChips: Number(formData.get("initialChips")),
    rebuyChips: Number(formData.get("rebuyChips") ?? 0),
    addonChips: Number(formData.get("addonChips") ?? 0),
    maxRebuys: Number(formData.get("maxRebuys") ?? 0),
    allowAddon: formData.get("allowAddon") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(tournaments)
    .set({
      ...parsed.data,
      date: new Date(parsed.data.date),
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, id));

  revalidatePath(`/torneios/${id}`);
  revalidatePath("/torneios");
  redirect(`/torneios/${id}`);
}

export async function updateTournamentStatus(
  id: number,
  status: "pending" | "running" | "finished" | "cancelled"
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db
    .update(tournaments)
    .set({ status, updatedAt: new Date() })
    .where(eq(tournaments.id, id));

  revalidatePath(`/torneios/${id}`);
  revalidatePath("/torneios");
  return { success: true };
}

export async function deleteTournament(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(tournaments).where(eq(tournaments.id, id));

  revalidatePath("/torneios");
  redirect("/torneios");
}

export async function updateBlindStructure(
  tournamentId: number,
  levels: {
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    durationMinutes: number;
    isBreak: boolean;
    isAddonLevel: boolean;
    isBigAnte: boolean;
  }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db
    .delete(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId));

  if (levels.length > 0) {
    await db.insert(blindStructures).values(
      levels.map((l) => ({ tournamentId, ...l }))
    );
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: "Estrutura de blinds atualizada!" };
}

export async function deletePrizeStructure(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(prizeStructures).where(eq(prizeStructures.tournamentId, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function startTimer(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      timerRemainingSecs: tournaments.timerRemainingSecs,
      currentBlindLevel: tournaments.currentBlindLevel,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  let remainingSecs = tournament.timerRemainingSecs;

  if (remainingSecs === null || remainingSecs === undefined) {
    const blinds = await db
      .select({ durationMinutes: blindStructures.durationMinutes })
      .from(blindStructures)
      .where(
        and(
          eq(blindStructures.tournamentId, tournamentId),
          eq(blindStructures.level, tournament.currentBlindLevel)
        )
      );
    remainingSecs = (blinds[0]?.durationMinutes ?? 15) * 60;
  }

  await db
    .update(tournaments)
    .set({
      timerRunning: true,
      timerStartedAt: new Date(),
      timerRemainingSecs: remainingSecs,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function pauseTimer(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      timerRemainingSecs: tournaments.timerRemainingSecs,
      timerStartedAt: tournaments.timerStartedAt,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament || !tournament.timerStartedAt) return { error: "Timer nao esta rodando" };

  const elapsed = Math.floor((Date.now() - new Date(tournament.timerStartedAt).getTime()) / 1000);
  const remaining = Math.max(0, (tournament.timerRemainingSecs ?? 0) - elapsed);

  await db
    .update(tournaments)
    .set({
      timerRunning: false,
      timerStartedAt: null,
      timerRemainingSecs: remaining,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function advanceBlindLevel(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      currentBlindLevel: tournaments.currentBlindLevel,
      timerRunning: tournaments.timerRunning,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const blinds = await db
    .select()
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);

  const currentIndex = blinds.findIndex((b) => b.level === tournament.currentBlindLevel);
  const nextLevel = blinds[currentIndex + 1];

  if (!nextLevel) return { error: "Ja esta no ultimo nivel" };

  await db
    .update(tournaments)
    .set({
      currentBlindLevel: nextLevel.level,
      timerRemainingSecs: nextLevel.durationMinutes * 60,
      timerStartedAt: tournament.timerRunning ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function goBackBlindLevel(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({ currentBlindLevel: tournaments.currentBlindLevel })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const blinds = await db
    .select()
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);

  const currentIndex = blinds.findIndex((b) => b.level === tournament.currentBlindLevel);
  const prevLevel = blinds[currentIndex - 1];

  if (!prevLevel) return { error: "Ja esta no primeiro nivel" };

  await db
    .update(tournaments)
    .set({
      currentBlindLevel: prevLevel.level,
      timerRemainingSecs: prevLevel.durationMinutes * 60,
      timerRunning: false,
      timerStartedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function updatePrizeStructure(
  tournamentId: number,
  positions: { position: number; percentage: number }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const total = positions.reduce((sum, p) => sum + p.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { error: `Percentuais devem somar 100% (atual: ${total}%)` };
  }

  await db
    .delete(prizeStructures)
    .where(eq(prizeStructures.tournamentId, tournamentId));

  if (positions.length > 0) {
    await db.insert(prizeStructures).values(
      positions.map((p) => ({
        tournamentId,
        position: p.position,
        percentage: String(p.percentage),
      }))
    );
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: "Estrutura de premios atualizada!" };
}

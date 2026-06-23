"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tournaments, blindStructures, prizeStructures, participants } from "@/db/schema";
import { eq, and, isNotNull, gt, asc } from "drizzle-orm";
import { getPointsForPosition } from "@/lib/points-table";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_BLIND_STRUCTURE, DEFAULT_PRIZE_STRUCTURE } from "@/lib/tournament-defaults";

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
  bonusChipAmount: z.number().min(0).default(0),
  maxRebuys: z.number().min(0).default(0),
  allowAddon: z.boolean().default(false),
  rankingFeeAmount: z.number().min(0).default(0),
  tournamentType: z.enum(["normal", "bounty_builder"]).default("normal"),
  bountyPercentage: z.number().min(1).max(99).default(50),
});

const blindLevelsSchema = z
  .array(
    z.object({
      level: z.number().int().min(0),
      smallBlind: z.number().min(0),
      bigBlind: z.number().min(0),
      ante: z.number().min(0),
      durationMinutes: z.number().min(0),
      isBreak: z.boolean(),
      isAddonLevel: z.boolean(),
      isBigAnte: z.boolean(),
    })
  )
  .superRefine((levels, ctx) => {
    const seen = new Set<number>();
    for (const l of levels) {
      if (seen.has(l.level)) {
        ctx.addIssue({ code: "custom", message: `Nivel ${l.level} duplicado` });
      }
      seen.add(l.level);
    }
  });

const prizePositionsSchema = z
  .array(
    z.object({
      position: z.number().int().min(1),
      percentage: z.number().min(0).max(100),
    })
  )
  .superRefine((items, ctx) => {
    const seen = new Set<number>();
    for (const item of items) {
      if (seen.has(item.position)) {
        ctx.addIssue({ code: "custom", message: `Posicao ${item.position} duplicada` });
      }
      seen.add(item.position);
    }
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
    bonusChipAmount: Number(formData.get("bonusChipAmount") ?? 0),
    maxRebuys: Number(formData.get("maxRebuys") ?? 0),
    allowAddon: formData.get("allowAddon") === "true",
    rankingFeeAmount: Number(formData.get("rankingFeeAmount") ?? 0),
    tournamentType: (formData.get("tournamentType") as "normal" | "bounty_builder") ?? "normal",
    bountyPercentage: Number(formData.get("bountyPercentage") ?? 50),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const tournament = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tournaments)
      .values({
        ...parsed.data,
        date: new Date(parsed.data.date),
        createdBy: auth.user.id,
      })
      .returning({ id: tournaments.id });

    await tx.insert(blindStructures).values(
      DEFAULT_BLIND_STRUCTURE.map((level) => ({
        tournamentId: created.id,
        ...level,
      }))
    );

    await tx.insert(prizeStructures).values(
      DEFAULT_PRIZE_STRUCTURE.map((p) => ({
        tournamentId: created.id,
        position: p.position,
        percentage: String(p.percentage),
      }))
    );

    return created;
  });

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
    bonusChipAmount: Number(formData.get("bonusChipAmount") ?? 0),
    maxRebuys: Number(formData.get("maxRebuys") ?? 0),
    allowAddon: formData.get("allowAddon") === "true",
    rankingFeeAmount: Number(formData.get("rankingFeeAmount") ?? 0),
    tournamentType: (formData.get("tournamentType") as "normal" | "bounty_builder") ?? "normal",
    bountyPercentage: Number(formData.get("bountyPercentage") ?? 50),
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

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: tournaments.status })
      .from(tournaments)
      .where(eq(tournaments.id, id));

    if (!current) return;
    if (status === "finished" && current.status === "finished") return;

    await tx
      .update(tournaments)
      .set({ status, updatedAt: new Date() })
      .where(eq(tournaments.id, id));

    if (status === "finished") {
      const finishedParticipants = await tx
        .select({ id: participants.id, finishPosition: participants.finishPosition })
        .from(participants)
        .where(and(eq(participants.tournamentId, id), isNotNull(participants.finishPosition)));

      for (const p of finishedParticipants) {
        if (p.finishPosition) {
          const points = getPointsForPosition(p.finishPosition);
          await tx
            .update(participants)
            .set({ pointsEarned: String(points) })
            .where(eq(participants.id, p.id));
        }
      }
    }
  });

  if (status === "finished") {
    revalidateTag("ranking");
  }

  revalidatePath(`/torneios/${id}`);
  revalidatePath("/torneios");
  revalidatePath("/ranking");
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

  const parsed = blindLevelsSchema.safeParse(levels);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(blindStructures)
        .where(eq(blindStructures.tournamentId, tournamentId));

      if (levels.length > 0) {
        // Only map the data columns explicitly. The editor's level objects may
        // carry stale `id`/`tournamentId` from when they were loaded (the rows
        // come straight from the DB), and spreading those into the insert would
        // force explicit values into the `serial` primary key — which collides
        // with existing rows and never advances the sequence. Let the DB assign
        // fresh ids.
        await tx.insert(blindStructures).values(
          levels.map((l) => ({
            tournamentId,
            level: l.level,
            smallBlind: l.smallBlind,
            bigBlind: l.bigBlind,
            ante: l.ante,
            durationMinutes: l.durationMinutes,
            isBreak: l.isBreak,
            isAddonLevel: l.isAddonLevel,
            isBigAnte: l.isBigAnte,
          }))
        );
      }
    });
  } catch (e) {
    console.error("updateBlindStructure failed", e);
    return {
      error: e instanceof Error ? `Erro ao salvar blinds: ${e.message}` : "Erro ao salvar blinds",
    };
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

  const [nextLevel] = await db
    .select()
    .from(blindStructures)
    .where(
      and(
        eq(blindStructures.tournamentId, tournamentId),
        gt(blindStructures.level, tournament.currentBlindLevel)
      )
    )
    .orderBy(asc(blindStructures.level))
    .limit(1);

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

export async function startBreak(tournamentId: number, durationMinutes: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      timerRemainingSecs: tournaments.timerRemainingSecs,
      timerStartedAt: tournaments.timerStartedAt,
      timerRunning: tournaments.timerRunning,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  // Calcula o tempo restante atual para salvar antes do intervalo
  let levelRemaining = tournament.timerRemainingSecs ?? 0;
  if (tournament.timerRunning && tournament.timerStartedAt) {
    const elapsed = Math.floor((Date.now() - new Date(tournament.timerStartedAt).getTime()) / 1000);
    levelRemaining = Math.max(0, levelRemaining - elapsed);
  }

  await db
    .update(tournaments)
    .set({
      breakActive: true,
      levelRemainingSecs: levelRemaining,
      timerRemainingSecs: durationMinutes * 60,
      timerRunning: true,
      timerStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function endBreak(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({ levelRemainingSecs: tournaments.levelRemainingSecs })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  await db
    .update(tournaments)
    .set({
      breakActive: false,
      levelRemainingSecs: null,
      timerRemainingSecs: tournament.levelRemainingSecs ?? 0,
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

  const parsed = prizePositionsSchema.safeParse(positions);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const total = positions.reduce((sum, p) => sum + p.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { error: `Percentuais devem somar 100% (atual: ${total}%)` };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(prizeStructures)
        .where(eq(prizeStructures.tournamentId, tournamentId));

      if (positions.length > 0) {
        await tx.insert(prizeStructures).values(
          positions.map((p) => ({
            tournamentId,
            position: p.position,
            percentage: String(p.percentage),
          }))
        );
      }
    });
  } catch (e) {
    console.error("updatePrizeStructure failed", e);
    return {
      error: e instanceof Error ? `Erro ao salvar premios: ${e.message}` : "Erro ao salvar premios",
    };
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: "Estrutura de premios atualizada!" };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tournaments, blindStructures, prizeStructures, participants } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { computeParticipantPoints } from "@/lib/points-table";
import { countKnockoutsByEliminator } from "@/db/ledger/knockout-ledger";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_BLIND_STRUCTURE, DEFAULT_PRIZE_STRUCTURE } from "@/lib/tournament-defaults";
import {
  startTimer as startClockTimer,
  pauseTimer as pauseClockTimer,
  advanceLevel,
  goBackLevel,
  expireLevel as expireLevelClock,
  startBreak as startBreakClock,
  endBreak as endBreakClock,
  reanchorLevel,
} from "@/lib/tournament-clock";

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

  const [current] = await db
    .select({ status: tournaments.status, tournamentType: tournaments.tournamentType })
    .from(tournaments)
    .where(eq(tournaments.id, id));

  if (!current) return { error: "Torneio nao encontrado" };
  // Idempotent re-finish stays a silent no-op (test 7 relies on this).
  if (status === "finished" && current.status === "finished") return { success: true };

  const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
    pending: ["running", "finished", "cancelled"],
    running: ["finished", "cancelled", "pending"],
    finished: [],
    cancelled: [],
  };
  if (!ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
    return { error: "Transicao de status invalida" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tournaments)
      .set({ status, updatedAt: new Date() })
      .where(eq(tournaments.id, id));

    if (status === "finished") {
      const isBounty = current.tournamentType === "bounty_builder";

      // Knockouts por Eliminador a partir do Ledger de Knockout (sem a autocoleta da Coroação).
      const koByPlayer = isBounty ? await countKnockoutsByEliminator(tx, id) : new Map<number, number>();

      const finishedParticipants = await tx
        .select({
          id: participants.id,
          playerId: participants.playerId,
          finishPosition: participants.finishPosition,
        })
        .from(participants)
        .where(and(eq(participants.tournamentId, id), isNotNull(participants.finishPosition)));

      for (const p of finishedParticipants) {
        if (p.finishPosition) {
          const knockouts = koByPlayer.get(p.playerId) ?? 0;
          const points = computeParticipantPoints(p.finishPosition, knockouts);
          await tx
            .update(participants)
            .set({ pointsEarned: points.toFixed(2) })
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
      // Trava a linha: o estado do Relógio lido aqui é regravado inteiro
      // depois, e um clique no Relógio no meio não pode ser sobrescrito.
      const [tournament] = await tx
        .select(CLOCK_STATE_COLUMNS)
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .for("update");

      // Conteudo do Nivel atual antes da edicao, pra reancorar (reanchorLevel).
      const [oldCurrent] = tournament
        ? await tx
            .select({
              level: blindStructures.level,
              smallBlind: blindStructures.smallBlind,
              bigBlind: blindStructures.bigBlind,
              ante: blindStructures.ante,
              durationMinutes: blindStructures.durationMinutes,
              isBreak: blindStructures.isBreak,
              isAddonLevel: blindStructures.isAddonLevel,
              isBigAnte: blindStructures.isBigAnte,
            })
            .from(blindStructures)
            .where(
              and(
                eq(blindStructures.tournamentId, tournamentId),
                eq(blindStructures.level, tournament.currentBlindLevel)
              )
            )
        : [];

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

      if (tournament) {
        const result = reanchorLevel(tournament, oldCurrent ?? null, levels);
        if (result.ok && result.changed) {
          await tx
            .update(tournaments)
            .set({
              currentBlindLevel: result.state.currentBlindLevel,
              timerRunning: result.state.timerRunning,
              timerStartedAt: result.state.timerStartedAt,
              timerRemainingSecs: result.state.timerRemainingSecs,
              updatedAt: new Date(),
            })
            .where(eq(tournaments.id, tournamentId));
        }
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

const CLOCK_STATE_COLUMNS = {
  currentBlindLevel: tournaments.currentBlindLevel,
  timerRunning: tournaments.timerRunning,
  timerRemainingSecs: tournaments.timerRemainingSecs,
  timerStartedAt: tournaments.timerStartedAt,
  breakActive: tournaments.breakActive,
  levelRemainingSecs: tournaments.levelRemainingSecs,
  breakTotalSecs: tournaments.breakTotalSecs,
} as const;

async function loadClockLevels(tournamentId: number) {
  return db
    .select({ level: blindStructures.level, durationMinutes: blindStructures.durationMinutes, isBreak: blindStructures.isBreak })
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId));
}

export async function startTimer(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const levels = await loadClockLevels(tournamentId);
  const result = startClockTimer(tournament, levels, new Date());
  if (!result.ok) return { error: result.error };

  const updated = await db
    .update(tournaments)
    .set({
      timerRunning: result.state.timerRunning,
      timerStartedAt: result.state.timerStartedAt,
      timerRemainingSecs: result.state.timerRemainingSecs,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.timerRunning, tournament.timerRunning)))
    .returning({ id: tournaments.id });

  if (updated.length === 0) return { error: "A mesa mudou, recarregue e tente de novo" };

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function pauseTimer(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const result = pauseClockTimer(tournament, new Date());
  if (!result.ok) return { error: result.error };

  const updated = await db
    .update(tournaments)
    .set({
      timerRunning: result.state.timerRunning,
      timerStartedAt: result.state.timerStartedAt,
      timerRemainingSecs: result.state.timerRemainingSecs,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.timerRunning, tournament.timerRunning)))
    .returning({ id: tournaments.id });

  if (updated.length === 0) return { error: "A mesa mudou, recarregue e tente de novo" };

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function advanceBlindLevel(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const levels = await loadClockLevels(tournamentId);
  const result = advanceLevel(tournament, levels, new Date());
  if (!result.ok) return { error: result.error };

  const updated = await db
    .update(tournaments)
    .set({
      currentBlindLevel: result.state.currentBlindLevel,
      timerRemainingSecs: result.state.timerRemainingSecs,
      timerStartedAt: result.state.timerStartedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.currentBlindLevel, tournament.currentBlindLevel)))
    .returning({ id: tournaments.id });

  if (updated.length === 0) return { error: "A mesa mudou, recarregue e tente de novo" };

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function goBackBlindLevel(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const levels = await loadClockLevels(tournamentId);
  const result = goBackLevel(tournament, levels);
  if (!result.ok) return { error: result.error };

  const updated = await db
    .update(tournaments)
    .set({
      currentBlindLevel: result.state.currentBlindLevel,
      timerRemainingSecs: result.state.timerRemainingSecs,
      timerRunning: result.state.timerRunning,
      timerStartedAt: result.state.timerStartedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.currentBlindLevel, tournament.currentBlindLevel)))
    .returning({ id: tournaments.id });

  if (updated.length === 0) return { error: "A mesa mudou, recarregue e tente de novo" };

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

// Fim do nível: a tela informa o timerStartedAt que observou. Se outra
// aba/dispositivo admin já processou este mesmo zero (o gravado mudou),
// responde sucesso em silêncio em vez de avançar de novo e pular um Nível.
export async function expireLevel(tournamentId: number, observedTimerStartedAt: string | null) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const levels = await loadClockLevels(tournamentId);
  const result = expireLevelClock(tournament, levels, observedTimerStartedAt, new Date());
  if (!result.ok) return { error: result.error };
  if (!result.changed) return { success: true };

  const updated = await db
    .update(tournaments)
    .set({
      currentBlindLevel: result.state.currentBlindLevel,
      timerRunning: result.state.timerRunning,
      timerRemainingSecs: result.state.timerRemainingSecs,
      timerStartedAt: result.state.timerStartedAt,
      breakActive: result.state.breakActive,
      levelRemainingSecs: result.state.levelRemainingSecs,
      breakTotalSecs: result.state.breakTotalSecs,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.currentBlindLevel, tournament.currentBlindLevel)))
    .returning({ id: tournaments.id });

  // Conflito aqui é a mesma corrida de duas telas, mas o Fim do nível dispara
  // por máquina: responde sucesso em silêncio em vez de "A mesa mudou".
  if (updated.length === 0) return { success: true };

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function startBreak(tournamentId: number, durationMinutes: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const nextState = startBreakClock(tournament, durationMinutes, new Date());

  const updated = await db
    .update(tournaments)
    .set({
      breakActive: nextState.breakActive,
      levelRemainingSecs: nextState.levelRemainingSecs,
      breakTotalSecs: nextState.breakTotalSecs,
      timerRemainingSecs: nextState.timerRemainingSecs,
      timerRunning: nextState.timerRunning,
      timerStartedAt: nextState.timerStartedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.breakActive, tournament.breakActive)))
    .returning({ id: tournaments.id });

  if (updated.length === 0) return { error: "A mesa mudou, recarregue e tente de novo" };

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function endBreak(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select(CLOCK_STATE_COLUMNS)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const result = endBreakClock(tournament);
  if (!result.ok) return { error: result.error };
  // Idempotente: se duas abas admin disparam o "Encerrar intervalo" ou o
  // auto-advance no mesmo instante, a segunda chamada acha o intervalo ja
  // encerrado e nao deve zerar timerRemainingSecs de novo.
  if (!result.changed) return { success: true };

  const updated = await db
    .update(tournaments)
    .set({
      breakActive: result.state.breakActive,
      levelRemainingSecs: result.state.levelRemainingSecs,
      breakTotalSecs: result.state.breakTotalSecs,
      timerRemainingSecs: result.state.timerRemainingSecs,
      timerRunning: result.state.timerRunning,
      timerStartedAt: result.state.timerStartedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.breakActive, tournament.breakActive)))
    .returning({ id: tournaments.id });

  if (updated.length === 0) return { error: "A mesa mudou, recarregue e tente de novo" };

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

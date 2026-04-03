"use server";

import { db } from "@/db";
import { participants, transactions, tournaments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { getParticipantById, getParticipantByPlayerAndTournament, getPlayingCount } from "@/db/queries/participants";

export async function addParticipant(tournamentId: number, playerId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({ status: tournaments.status })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };
  if (["finished", "cancelled"].includes(tournament.status)) {
    return { error: "Nao e possivel adicionar jogadores a este torneio" };
  }

  const existing = await getParticipantByPlayerAndTournament(playerId, tournamentId);
  if (existing) return { error: "Jogador ja inscrito neste torneio" };

  await db.insert(participants).values({ tournamentId, playerId });

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function removeParticipant(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.status !== "registered") {
    return { error: "Apenas jogadores com status 'registrado' podem ser removidos" };
  }

  await db.delete(participants).where(eq(participants.id, participantId));

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function confirmBuyIn(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.buyInPaid) return { error: "Buy-in ja confirmado" };

  const [tournament] = await db
    .select({ buyInAmount: tournaments.buyInAmount })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  await db
    .update(participants)
    .set({ buyInPaid: true, status: "playing" })
    .where(eq(participants.id, participantId));

  await db.insert(transactions).values({
    tournamentId: participant.tournamentId,
    playerId: participant.playerId,
    type: "buy_in",
    amount: tournament.buyInAmount,
  });

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function addRebuy(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (!participant.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };

  const [tournament] = await db
    .select({ rebuyAmount: tournaments.rebuyAmount, maxRebuys: tournaments.maxRebuys })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  if (tournament.rebuyAmount === 0) return { error: "Torneio nao permite rebuy" };
  if (tournament.maxRebuys > 0 && participant.rebuyCount >= tournament.maxRebuys) {
    return { error: `Limite de rebuys atingido (max: ${tournament.maxRebuys})` };
  }

  await db
    .update(participants)
    .set({ rebuyCount: participant.rebuyCount + 1 })
    .where(eq(participants.id, participantId));

  await db.insert(transactions).values({
    tournamentId: participant.tournamentId,
    playerId: participant.playerId,
    type: "rebuy",
    amount: tournament.rebuyAmount,
  });

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function addAddon(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.addonUsed) return { error: "Add-on ja utilizado" };

  const [tournament] = await db
    .select({ allowAddon: tournaments.allowAddon, addonAmount: tournaments.addonAmount })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  if (!tournament.allowAddon) return { error: "Torneio nao permite add-on" };

  await db
    .update(participants)
    .set({ addonUsed: true })
    .where(eq(participants.id, participantId));

  await db.insert(transactions).values({
    tournamentId: participant.tournamentId,
    playerId: participant.playerId,
    type: "addon",
    amount: tournament.addonAmount,
  });

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function eliminatePlayer(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.status !== "playing") return { error: "Jogador nao esta em jogo" };

  const playingCount = await getPlayingCount(participant.tournamentId);
  const finishPosition = playingCount;

  await db
    .update(participants)
    .set({ status: "eliminated", finishPosition, eliminatedAt: new Date() })
    .where(eq(participants.id, participantId));

  if (playingCount - 1 === 1) {
    const [champion] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.tournamentId, participant.tournamentId), eq(participants.status, "playing")));

    if (champion) {
      await db
        .update(participants)
        .set({ status: "finished", finishPosition: 1 })
        .where(eq(participants.id, champion.id));
    }

    const [t] = await db
      .select({ timerRunning: tournaments.timerRunning, timerRemainingSecs: tournaments.timerRemainingSecs, timerStartedAt: tournaments.timerStartedAt })
      .from(tournaments)
      .where(eq(tournaments.id, participant.tournamentId));

    if (t?.timerRunning && t.timerStartedAt) {
      const elapsed = Math.floor((Date.now() - new Date(t.timerStartedAt).getTime()) / 1000);
      const remaining = Math.max(0, (t.timerRemainingSecs ?? 0) - elapsed);
      await db
        .update(tournaments)
        .set({ timerRunning: false, timerStartedAt: null, timerRemainingSecs: remaining, updatedAt: new Date() })
        .where(eq(tournaments.id, participant.tournamentId));
    }
  }

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function undoElimination(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.status !== "eliminated" && participant.status !== "finished") {
    return { error: "Jogador nao esta eliminado" };
  }

  await db
    .update(participants)
    .set({ status: "playing", finishPosition: null, eliminatedAt: null })
    .where(eq(participants.id, participantId));

  if (participant.status === "eliminated") {
    await db
      .update(participants)
      .set({ status: "playing", finishPosition: null })
      .where(
        and(
          eq(participants.tournamentId, participant.tournamentId),
          eq(participants.status, "finished")
        )
      );
  }

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function distributePayouts(
  tournamentId: number,
  payouts: { playerId: number; amount: number; position: number }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db
    .delete(transactions)
    .where(and(eq(transactions.tournamentId, tournamentId), eq(transactions.type, "prize")));

  for (const payout of payouts) {
    if (payout.amount > 0) {
      await db.insert(transactions).values({
        tournamentId,
        playerId: payout.playerId,
        type: "prize",
        amount: payout.amount,
      });

      await db
        .update(participants)
        .set({ prizeAmount: payout.amount })
        .where(
          and(eq(participants.tournamentId, tournamentId), eq(participants.playerId, payout.playerId))
        );
    }
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

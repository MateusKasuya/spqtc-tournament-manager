"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { participants, transactions, tournaments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getParticipantById, getParticipantByUserAndTournament, getPlayingCount } from "@/db/queries/participants";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

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

export async function addParticipant(tournamentId: number, userId: string) {
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

  const existing = await getParticipantByUserAndTournament(userId, tournamentId);
  if (existing) return { error: "Jogador ja inscrito neste torneio" };

  await db.insert(participants).values({ tournamentId, userId });

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
    userId: participant.userId,
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
    userId: participant.userId,
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
    userId: participant.userId,
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
  const finishPosition = playingCount; // ex: 5 jogando -> eliminado fica em 5o

  await db
    .update(participants)
    .set({ status: "eliminated", finishPosition, eliminatedAt: new Date() })
    .where(eq(participants.id, participantId));

  // Se restou apenas 1 jogando, esse e o campeao
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
  }

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function undoElimination(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.status !== "eliminated") return { error: "Jogador nao esta eliminado" };

  await db
    .update(participants)
    .set({ status: "playing", finishPosition: null, eliminatedAt: null })
    .where(eq(participants.id, participantId));

  revalidatePath(`/torneios/${participant.tournamentId}`);
  return { success: true };
}

export async function distributePayouts(
  tournamentId: number,
  payouts: { userId: string; amount: number; position: number }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  // Remove premios anteriores
  await db
    .delete(transactions)
    .where(and(eq(transactions.tournamentId, tournamentId), eq(transactions.type, "prize")));

  // Insere novos premios e atualiza prize_amount nos participantes
  for (const payout of payouts) {
    if (payout.amount > 0) {
      await db.insert(transactions).values({
        tournamentId,
        userId: payout.userId,
        type: "prize",
        amount: payout.amount,
      });

      await db
        .update(participants)
        .set({ prizeAmount: payout.amount })
        .where(
          and(eq(participants.tournamentId, tournamentId), eq(participants.userId, payout.userId))
        );
    }
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function selfRegister(tournamentId: number) {
  const user = await getAuthUser();
  if (!user) return { error: "Nao autenticado" };

  const [tournament] = await db
    .select({ status: tournaments.status })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };
  if (["finished", "cancelled"].includes(tournament.status)) {
    return { error: "Inscricoes encerradas para este torneio" };
  }

  const existing = await getParticipantByUserAndTournament(user.id, tournamentId);
  if (existing) return { error: "Voce ja esta inscrito neste torneio" };

  await db.insert(participants).values({ tournamentId, userId: user.id });

  revalidatePath(`/torneios/${tournamentId}`);
  revalidatePath(`/torneios/${tournamentId}/inscricao`);
  return { success: true };
}

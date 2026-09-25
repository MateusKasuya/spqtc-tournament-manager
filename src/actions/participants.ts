"use server";

import { db } from "@/db";
import { participants, transactions, tournaments } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateTournament } from "@/lib/revalidate-tournament";
import { STATUS_RULES } from "@/lib/tournament-status";
import { clockStateColumns, getTournamentRequiringStatus } from "@/db/queries/tournaments";
import { getParticipantById, getParticipantByPlayerAndTournament, getParticipants } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { computePrizePool } from "@/lib/prize-pool";
import { formatCurrency } from "@/lib/format";
import { checkKnockout, checkUndo, initialBounty, KnockoutLedgerError, type KnockoutEvent, type UndoRequest } from "@/lib/knockout-ledger";
import { applyKnockout, undoKnockout, loadKnockoutSnapshot } from "@/db/ledger/knockout-ledger";
import { pauseTimer } from "@/lib/tournament-clock";
import { z } from "zod";

export async function addParticipant(tournamentId: number, playerId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const loaded = await getTournamentRequiringStatus(tournamentId, STATUS_RULES.registration);
  if ("error" in loaded) return loaded;

  const existing = await getParticipantByPlayerAndTournament(playerId, tournamentId);
  if (existing) return { error: "Jogador ja inscrito neste torneio" };

  const inserted = await db
    .insert(participants)
    .values({ tournamentId, playerId })
    .onConflictDoNothing()
    .returning({ id: participants.id });

  if (inserted.length === 0) return { error: "Jogador ja inscrito neste torneio" };

  revalidateTournament(tournamentId);
  return { success: true };
}

export async function addParticipants(tournamentId: number, playerIds: number[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  if (playerIds.length === 0) return { error: "Nenhum jogador selecionado" };

  const loaded = await getTournamentRequiringStatus(tournamentId, STATUS_RULES.registration);
  if ("error" in loaded) return loaded;

  const existing = await db
    .select({ playerId: participants.playerId })
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), inArray(participants.playerId, playerIds)));
  const existingIds = new Set(existing.map((e) => e.playerId));
  const newPlayerIds = playerIds.filter((id) => !existingIds.has(id));

  if (newPlayerIds.length === 0) return { error: "Jogadores ja inscritos neste torneio" };

  await db.insert(participants).values(newPlayerIds.map((playerId) => ({ tournamentId, playerId })));

  revalidateTournament(tournamentId);
  return { success: true };
}

export async function removeParticipant(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.registration);
  if ("error" in loaded) return loaded;
  if (participant.status !== "registered") {
    return { error: "Apenas jogadores com status 'registrado' podem ser removidos" };
  }

  await db.delete(participants).where(eq(participants.id, participantId));

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

export async function confirmBuyIn(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.registration);
  if ("error" in loaded) return loaded;
  const { tournament } = loaded;
  if (participant.buyInPaid) return { error: "Buy-in ja confirmado" };

  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ buyInPaid: true, status: "playing", currentBounty: initialBounty(tournament) })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values({
      tournamentId: participant.tournamentId,
      playerId: participant.playerId,
      type: "buy_in",
      amount: tournament.buyInAmount,
    });
  });

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

export async function undoBuyIn(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.registration);
  if ("error" in loaded) return loaded;
  if (!participant.buyInPaid) return { error: "Buy-in nao confirmado" };
  if (participant.status !== "playing") {
    return { error: "Desfaca a eliminacao antes de remover o buy-in" };
  }
  if (
    participant.rebuyCount > 0 ||
    participant.addonCount > 0 ||
    participant.bonusChipUsed ||
    participant.bountiesCollected > 0
  ) {
    return { error: "Desfaca rebuys, add-ons, bonus e bounties antes de remover o buy-in" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(
      and(
        eq(transactions.playerId, participant.playerId),
        eq(transactions.tournamentId, participant.tournamentId),
        eq(transactions.type, "buy_in")
      )
    );

    await tx
      .update(participants)
      .set({ buyInPaid: false, status: "registered", currentBounty: 0 })
      .where(eq(participants.id, participantId));
  });

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Contexto de um Knockout ou Desfazer: o participante e o snapshot do torneio
// lido fora da transação, para a precondição responder ao admin. Só Rodando.
async function loadKnockoutContext(participantId: number) {
  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.live);
  if ("error" in loaded) return loaded;
  const snapshot = await loadKnockoutSnapshot(db, participant.tournamentId);
  if (!snapshot) return { error: "Torneio nao encontrado" };
  return { participant, snapshot };
}

// Roda a operação do ledger na transação; estado esperado do ledger vira
// { error } no contrato da action, bug/infra continua lançando.
async function runKnockoutLedger(work: (tx: Tx) => Promise<unknown>) {
  try {
    await db.transaction(work);
    return null;
  } catch (e) {
    if (e instanceof KnockoutLedgerError) return { error: e.message };
    throw e;
  }
}

// Rebuy e rebuy duplo são o mesmo Knockout com count 1 ou 2; addDoubleRebuy
// continua exportada porque a mesa a chama por nome.
async function registerRebuy(participantId: number, eliminatedByPlayerIds: number[] | undefined, count: 1 | 2) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const ctx = await loadKnockoutContext(participantId);
  if ("error" in ctx) return ctx;

  const event: KnockoutEvent = { kind: "rebuy", victimId: participantId, eliminatorPlayerIds: eliminatedByPlayerIds ?? [], count };
  const refused = checkKnockout(ctx.snapshot, event);
  if (refused) return refused;

  const failed = await runKnockoutLedger((tx) => applyKnockout(tx, ctx.participant.tournamentId, event));
  if (failed) return failed;

  revalidateTournament(ctx.participant.tournamentId);
  return { success: true };
}

export async function addRebuy(participantId: number, eliminatedByPlayerIds?: number[]) {
  return registerRebuy(participantId, eliminatedByPlayerIds, 1);
}

export async function addDoubleRebuy(participantId: number, eliminatedByPlayerIds?: number[]) {
  return registerRebuy(participantId, eliminatedByPlayerIds, 2);
}

export async function addAddon(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.live);
  if ("error" in loaded) return loaded;
  const { tournament } = loaded;
  if (!participant.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };
  if (!tournament.allowAddon) return { error: "Torneio nao permite add-on" };

  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ addonCount: participant.addonCount + 1 })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values({
      tournamentId: participant.tournamentId,
      playerId: participant.playerId,
      type: "addon",
      amount: tournament.addonAmount,
    });
  });

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

export async function undoRebuy(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const ctx = await loadKnockoutContext(participantId);
  if ("error" in ctx) return ctx;

  const req: UndoRequest = { kind: "rebuy", victimId: participantId };
  const refused = checkUndo(ctx.snapshot, req);
  if (refused) return refused;

  const failed = await runKnockoutLedger((tx) => undoKnockout(tx, ctx.participant.tournamentId, req));
  if (failed) return failed;

  revalidateTournament(ctx.participant.tournamentId);
  return { success: true };
}

export async function undoAddon(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.live);
  if ("error" in loaded) return loaded;
  if (participant.addonCount <= 0) return { error: "Nenhum add-on para desfazer" };

  const [lastAddonTx] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.playerId, participant.playerId),
        eq(transactions.tournamentId, participant.tournamentId),
        eq(transactions.type, "addon")
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  await db.transaction(async (tx) => {
    if (lastAddonTx) {
      await tx.delete(transactions).where(eq(transactions.id, lastAddonTx.id));
    }

    await tx
      .update(participants)
      .set({ addonCount: participant.addonCount - 1 })
      .where(eq(participants.id, participantId));
  });

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

export async function addBonusChip(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.live);
  if ("error" in loaded) return loaded;
  const { tournament } = loaded;
  if (participant.bonusChipUsed) return { error: "Bonus chip ja utilizado" };
  if (tournament.bonusChipAmount === 0) return { error: "Torneio nao permite bonus chip" };

  await db
    .update(participants)
    .set({ bonusChipUsed: true })
    .where(eq(participants.id, participantId));

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

export async function undoBonusChip(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  const loaded = await getTournamentRequiringStatus(participant.tournamentId, STATUS_RULES.live);
  if ("error" in loaded) return loaded;
  if (!participant.bonusChipUsed) return { error: "Bonus chip nao foi utilizado" };

  await db
    .update(participants)
    .set({ bonusChipUsed: false })
    .where(eq(participants.id, participantId));

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

// Pausa o timer quando a eliminação final coroa o campeão; fica na action
// porque o relógio do torneio não pertence ao Ledger de Knockout. Mesma
// transição Pausar do núcleo do Relógio, aplicada dentro da tx do ledger —
// já protegida pelo lock do torneio, sem update condicional aqui.
async function pauseTimerAtEnd(tx: Tx, tournamentId: number) {
  const [t] = await tx
    .select(clockStateColumns)
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!t) return;
  const result = pauseTimer(t, new Date());
  if (!result.ok) return;

  await tx
    .update(tournaments)
    .set({
      timerRunning: result.state.timerRunning,
      timerStartedAt: result.state.timerStartedAt,
      timerRemainingSecs: result.state.timerRemainingSecs,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));
}

export async function eliminatePlayer(participantId: number, eliminatedByPlayerIds?: number[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const ctx = await loadKnockoutContext(participantId);
  if ("error" in ctx) return ctx;

  const event: KnockoutEvent = { kind: "elimination", victimId: participantId, eliminatorPlayerIds: eliminatedByPlayerIds ?? [] };
  const refused = checkKnockout(ctx.snapshot, event);
  if (refused) return refused;

  const failed = await runKnockoutLedger(async (tx) => {
    const { crowned } = await applyKnockout(tx, ctx.participant.tournamentId, event);
    if (crowned) await pauseTimerAtEnd(tx, ctx.participant.tournamentId);
  });
  if (failed) return failed;

  revalidateTournament(ctx.participant.tournamentId);
  return { success: true };
}

export async function undoElimination(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const ctx = await loadKnockoutContext(participantId);
  if ("error" in ctx) return ctx;

  const req: UndoRequest = { kind: "elimination", victimId: participantId };
  const refused = checkUndo(ctx.snapshot, req);
  if (refused) return refused;

  const failed = await runKnockoutLedger((tx) => undoKnockout(tx, ctx.participant.tournamentId, req));
  if (failed) return failed;

  revalidateTournament(ctx.participant.tournamentId);
  return { success: true };
}

const payoutSchema = z.object({
  playerId: z.number().int().positive(),
  amount: z.number().int().min(0),
  position: z.number().int().min(1),
});

export async function distributePayouts(
  tournamentId: number,
  payouts: { playerId: number; amount: number; position: number }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = z.array(payoutSchema).safeParse(payouts);
  if (!parsed.success) return { error: "Premios invalidos" };
  const items = parsed.data;

  const ids = items.map((p) => p.playerId);
  if (new Set(ids).size !== ids.length) {
    return { error: "Mesmo jogador em mais de uma posicao" };
  }

  const existing = ids.length
    ? await db
        .select({ playerId: participants.playerId })
        .from(participants)
        .where(and(eq(participants.tournamentId, tournamentId), inArray(participants.playerId, ids)))
    : [];
  const valid = new Set(existing.map((r) => r.playerId));
  const allowed = items.filter((p) => valid.has(p.playerId));

  // Acordo na mesa final (Rodando) ou acerto no fim (Encerrado); Pendente e Cancelado não pagam.
  const loaded = await getTournamentRequiringStatus(tournamentId, STATUS_RULES.payouts);
  if ("error" in loaded) return loaded;
  const { tournament } = loaded;

  const [collected, tournamentParticipants] = await Promise.all([
    getTournamentFinancialSummary(tournamentId),
    getParticipants(tournamentId),
  ]);

  const { prizePool } = computePrizePool({ rules: tournament, collected, participants: tournamentParticipants });
  const total = allowed.reduce((sum, p) => sum + p.amount, 0);
  if (total > prizePool) {
    return {
      error: `Premios somam ${formatCurrency(total)}, acima do Prize pool de ${formatCurrency(prizePool)}`,
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(transactions)
      .where(and(eq(transactions.tournamentId, tournamentId), eq(transactions.type, "prize")));

    const transactionValues = allowed
      .filter((p) => p.amount > 0)
      .map((p) => ({
        tournamentId,
        playerId: p.playerId,
        type: "prize" as const,
        amount: p.amount,
      }));

    if (transactionValues.length > 0) {
      await tx.insert(transactions).values(transactionValues);
    }

    await Promise.all(
      allowed.map((p) =>
        tx
          .update(participants)
          .set({ prizeAmount: p.amount, finishPosition: p.position })
          .where(and(eq(participants.tournamentId, tournamentId), eq(participants.playerId, p.playerId)))
      )
    );
  });

  revalidateTournament(tournamentId);
  return { success: true };
}

"use server";

import { db } from "@/db";
import { participants, transactions, tournaments } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateTournament } from "@/lib/revalidate-tournament";
import { STATUS_RULES, type StatusRule } from "@/lib/tournament-status";
import { clockStateColumns, getTournamentRequiringStatus } from "@/db/queries/tournaments";
import { getParticipantById, getParticipantByPlayerAndTournament } from "@/db/queries/participants";
import { checkKnockout, checkUndo, initialBounty, KnockoutLedgerError, type KnockoutEvent, type UndoRequest } from "@/lib/knockout-ledger";
import { assertPremiosCabemNoPrizePool, assertSaldoNaoNegativo } from "@/db/ledger/saldo";
import { hasPaidPrize } from "@/db/queries/transactions";
import { SaldoNegativoError } from "@/lib/prize-pool";
import { applyKnockout, undoKnockout, loadKnockoutSnapshot, lockTournamentRequiringStatus, renumberFinalPositions } from "@/db/ledger/knockout-ledger";
import { pauseTimer } from "@/lib/tournament-clock";
import { applyPayoutPositions } from "@/db/ledger/payout-positions";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  checkAddAddon,
  checkAddBonusChip,
  checkPayoutRecipients,
  checkRemoveParticipant,
  checkConfirmBuyIn,
  checkUndoAddon,
  checkUndoBonusChip,
  checkUndoBuyIn,
  type Refusal,
} from "@/lib/participant-entries";
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
  const refused = checkRemoveParticipant(participant);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    const { participant: current } = await lockAndReload(
      tx,
      participant.tournamentId,
      participantId,
      STATUS_RULES.registration,
      checkRemoveParticipant
    );
    await refuseIfInPayout(tx, current);
    await tx.delete(participants).where(eq(participants.id, participantId));
  });
  if (failed) return failed;

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
  const refused = checkConfirmBuyIn(participant);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    const { tournament, participant: current } = await lockAndReload(
      tx,
      participant.tournamentId,
      participantId,
      STATUS_RULES.registration,
      checkConfirmBuyIn
    );

    await tx
      .update(participants)
      .set({ buyInPaid: true, status: "playing", currentBounty: initialBounty(tournament) })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values({
      tournamentId: current.tournamentId,
      playerId: current.playerId,
      type: "buy_in",
      amount: tournament.buyInAmount,
    });

    await renumberFinalPositions(tx, current.tournamentId);
  });
  if (failed) return failed;

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
  const refused = checkUndoBuyIn(participant);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    const { participant: current } = await lockAndReload(
      tx,
      participant.tournamentId,
      participantId,
      STATUS_RULES.registration,
      checkUndoBuyIn
    );
    await refuseIfInPayout(tx, current);

    await tx.delete(transactions).where(
      and(
        eq(transactions.playerId, current.playerId),
        eq(transactions.tournamentId, current.tournamentId),
        eq(transactions.type, "buy_in")
      )
    );

    await tx
      .update(participants)
      .set({ buyInPaid: false, status: "registered", currentBounty: 0 })
      .where(eq(participants.id, participantId));

    await renumberFinalPositions(tx, current.tournamentId);
    await assertSaldoNaoNegativo(tx, current.tournamentId);
  });
  if (failed) return failed;

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Participant = typeof participants.$inferSelect;
type Tournament = typeof tournaments.$inferSelect;

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

// Recusa de uma precondição relida dentro do lock; aborta a transação e vira
// { error } em runLedger, com a mesma mensagem da checagem de fora.
class ParticipantRefusal extends Error {}

// Trava o torneio, relê a linha e recusa se o Status relido não permitir a ação.
async function lockTournamentOrRefuse(tx: Tx, tournamentId: number, rule: StatusRule) {
  const locked = await lockTournamentRequiringStatus(tx, tournamentId, rule);
  if ("error" in locked) throw new ParticipantRefusal(locked.error);
  return locked.tournament;
}

// Trava o torneio, relê torneio e participante e roda nessa releitura a mesma
// precondição da checagem de fora: a decisão e os valores gravados saem desta
// leitura, não da feita fora da transação.
async function lockAndReload(
  tx: Tx,
  tournamentId: number,
  participantId: number,
  rule: StatusRule,
  check: (participant: Participant, tournament: Tournament) => Refusal
) {
  const tournament = await lockTournamentOrRefuse(tx, tournamentId, rule);
  const [participant] = await tx.select().from(participants).where(eq(participants.id, participantId));
  if (!participant) throw new ParticipantRefusal("Participante nao encontrado");
  const refused = check(participant, tournament);
  if (refused) throw new ParticipantRefusal(refused.error);
  return { tournament, participant };
}

// Prêmio pago e posição do Acordo só saem refazendo a distribuição: remover o
// participante ou desfazer o buy-in dele deixaria uma transação prize sem
// Participante, ou um Acordo com posição de quem não joga. Chamar dentro do lock.
async function refuseIfInPayout(
  tx: Tx,
  participant: Pick<Participant, "tournamentId" | "playerId" | "dealPosition">
) {
  if (await hasPaidPrize(participant.tournamentId, participant.playerId, tx)) {
    throw new ParticipantRefusal("Participante tem Premio pago: refaca a distribuicao de premios sem ele antes");
  }
  if (participant.dealPosition !== null) {
    throw new ParticipantRefusal("Participante esta no Acordo: refaca a distribuicao de premios sem ele antes");
  }
}

// Roda a operação do ledger e do Saldo na transação; recusa esperada (Knockout, Saldo ou
// precondição relida no lock) vira { error } no contrato da action, bug/infra continua lançando.
async function runLedger(work: (tx: Tx) => Promise<unknown>) {
  try {
    await db.transaction(work);
    return null;
  } catch (e) {
    if (e instanceof KnockoutLedgerError || e instanceof SaldoNegativoError || e instanceof ParticipantRefusal) {
      return { error: e.message };
    }
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

  const failed = await runLedger((tx) => applyKnockout(tx, ctx.participant.tournamentId, event));
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
  const refused = checkAddAddon(participant, loaded.tournament);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    const { tournament, participant: current } = await lockAndReload(
      tx,
      participant.tournamentId,
      participantId,
      STATUS_RULES.live,
      checkAddAddon
    );

    await tx
      .update(participants)
      .set({ addonCount: current.addonCount + 1 })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values({
      tournamentId: current.tournamentId,
      playerId: current.playerId,
      type: "addon",
      amount: tournament.addonAmount,
    });
  });
  if (failed) return failed;

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

  const failed = await runLedger(async (tx) => {
    await undoKnockout(tx, ctx.participant.tournamentId, req);
    await assertSaldoNaoNegativo(tx, ctx.participant.tournamentId);
  });
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
  const refused = checkUndoAddon(participant);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    const { participant: current } = await lockAndReload(
      tx,
      participant.tournamentId,
      participantId,
      STATUS_RULES.live,
      checkUndoAddon
    );

    const [lastAddonTx] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.playerId, current.playerId),
          eq(transactions.tournamentId, current.tournamentId),
          eq(transactions.type, "addon")
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(1);
    if (lastAddonTx) {
      await tx.delete(transactions).where(eq(transactions.id, lastAddonTx.id));
    }

    await tx
      .update(participants)
      .set({ addonCount: current.addonCount - 1 })
      .where(eq(participants.id, participantId));

    await assertSaldoNaoNegativo(tx, current.tournamentId);
  });
  if (failed) return failed;

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
  const refused = checkAddBonusChip(participant, loaded.tournament);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    await lockAndReload(tx, participant.tournamentId, participantId, STATUS_RULES.live, checkAddBonusChip);
    await tx
      .update(participants)
      .set({ bonusChipUsed: true })
      .where(eq(participants.id, participantId));
  });
  if (failed) return failed;

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
  const refused = checkUndoBonusChip(participant);
  if (refused) return refused;

  const failed = await runLedger(async (tx) => {
    await lockAndReload(tx, participant.tournamentId, participantId, STATUS_RULES.live, checkUndoBonusChip);
    await tx
      .update(participants)
      .set({ bonusChipUsed: false })
      .where(eq(participants.id, participantId));
  });
  if (failed) return failed;

  revalidateTournament(participant.tournamentId);
  return { success: true };
}

// Pausa o timer quando a eliminação final coroa o último Em jogo; fica na action
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

  const failed = await runLedger(async (tx) => {
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

  const failed = await runLedger((tx) => undoKnockout(tx, ctx.participant.tournamentId, req));
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

  // Acordo na mesa final (Rodando) ou acerto no fim (Encerrado); Pendente e Cancelado não pagam.
  const loaded = await getTournamentRequiringStatus(tournamentId, STATUS_RULES.payouts);
  if ("error" in loaded) return loaded;
  const total = items.reduce((sum, p) => sum + p.amount, 0);

  // Status, inscrição, buy-in e Prize pool decidem pela releitura dentro do lock,
  // para um Desfazer, Remover ou Cancelar concorrente não furar a trava.
  let rankingChanged = false;
  const failed = await runLedger(async (tx) => {
    const tournament = await lockTournamentOrRefuse(tx, tournamentId, STATUS_RULES.payouts);
    const enrolled = ids.length
      ? await tx
          .select({ playerId: participants.playerId, buyInPaid: participants.buyInPaid })
          .from(participants)
          .where(and(eq(participants.tournamentId, tournamentId), inArray(participants.playerId, ids)))
      : [];
    const refused = checkPayoutRecipients(items, enrolled);
    if (refused) throw new ParticipantRefusal(refused.error);
    await assertPremiosCabemNoPrizePool(tx, tournamentId, total);

    await tx
      .delete(transactions)
      .where(and(eq(transactions.tournamentId, tournamentId), eq(transactions.type, "prize")));

    const transactionValues = items
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

    await tx.update(participants).set({ prizeAmount: 0 }).where(eq(participants.tournamentId, tournamentId));
    for (const p of items) {
      await tx
        .update(participants)
        .set({ prizeAmount: p.amount })
        .where(and(eq(participants.tournamentId, tournamentId), eq(participants.playerId, p.playerId)));
    }

    ({ rankingChanged } = await applyPayoutPositions(tx, tournament, items));
  });
  if (failed) return failed;

  revalidateTournament(tournamentId);
  if (rankingChanged) {
    revalidateTag("ranking", { expire: 0 });
    revalidatePath("/ranking");
  }
  return { success: true };
}

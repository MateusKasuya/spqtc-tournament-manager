"use server";

import { db } from "@/db";
import { participants, transactions, tournaments } from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { getParticipantById, getParticipantByPlayerAndTournament } from "@/db/queries/participants";
import { computeBountyDistribution } from "@/lib/bounty";
import { checkKnockout, checkUndo, KnockoutLedgerError, type KnockoutEvent, type UndoRequest } from "@/lib/knockout-ledger";
import { applyKnockout, undoKnockout, loadKnockoutSnapshot, type LedgerExecutor } from "@/db/ledger/knockout-ledger";
import { z } from "zod";

// transactions.created_at is timestamptz (microsecond precision), but JS Date only
// has millisecond precision — reading it into a Date and comparing back via eq()
// silently drops the sub-millisecond digits, so the equality almost never matches
// in real Postgres (pglite's coarser clock hides this in tests). Casting to text
// keeps the exact stored value and the comparison never leaves SQL.
const CREATED_AT_TEXT = sql<string>`${transactions.createdAt}::text`;
function sameCreatedAt(createdAtText: string) {
  return eq(transactions.createdAt, sql`${createdAtText}::timestamptz`);
}

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

  const inserted = await db
    .insert(participants)
    .values({ tournamentId, playerId })
    .onConflictDoNothing()
    .returning({ id: participants.id });

  if (inserted.length === 0) return { error: "Jogador ja inscrito neste torneio" };

  revalidatePath(`/torneios/${tournamentId}`, "layout");
  return { success: true };
}

export async function addParticipants(tournamentId: number, playerIds: number[]) {
  if (playerIds.length === 0) return { error: "Nenhum jogador selecionado" };

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

  const existing = await db
    .select({ playerId: participants.playerId })
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), inArray(participants.playerId, playerIds)));
  const existingIds = new Set(existing.map((e) => e.playerId));
  const newPlayerIds = playerIds.filter((id) => !existingIds.has(id));

  if (newPlayerIds.length === 0) return { error: "Jogadores ja inscritos neste torneio" };

  await db.insert(participants).values(newPlayerIds.map((playerId) => ({ tournamentId, playerId })));

  revalidatePath(`/torneios/${tournamentId}`, "layout");
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

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function confirmBuyIn(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.buyInPaid) return { error: "Buy-in ja confirmado" };

  const [tournament] = await db
    .select({
      buyInAmount: tournaments.buyInAmount,
      rankingFeeAmount: tournaments.rankingFeeAmount,
      tournamentType: tournaments.tournamentType,
      bountyPercentage: tournaments.bountyPercentage,
    })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  const isBounty = tournament.tournamentType === "bounty_builder";
  const initialBounty = isBounty
    ? Math.floor(((tournament.buyInAmount - tournament.rankingFeeAmount) * tournament.bountyPercentage) / 100)
    : 0;

  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ buyInPaid: true, status: "playing", currentBounty: initialBounty })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values({
      tournamentId: participant.tournamentId,
      playerId: participant.playerId,
      type: "buy_in",
      amount: tournament.buyInAmount,
    });
  });

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function undoBuyIn(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
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

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function addRebuy(participantId: number, eliminatedByPlayerIds?: number[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (!participant.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };

  const [tournament] = await db
    .select({
      rebuyAmount: tournaments.rebuyAmount,
      maxRebuys: tournaments.maxRebuys,
      tournamentType: tournaments.tournamentType,
      bountyPercentage: tournaments.bountyPercentage,
    })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  if (tournament.rebuyAmount === 0) return { error: "Torneio nao permite rebuy" };
  if (tournament.maxRebuys > 0 && participant.rebuyCount >= tournament.maxRebuys) {
    return { error: `Limite de rebuys atingido (max: ${tournament.maxRebuys})` };
  }

  const isBounty = tournament.tournamentType === "bounty_builder";
  if (isBounty && (!eliminatedByPlayerIds || eliminatedByPlayerIds.length === 0)) {
    return { error: "Selecione quem eliminou o jogador" };
  }

  const newBounty = isBounty
    ? Math.floor((tournament.rebuyAmount * tournament.bountyPercentage) / 100)
    : 0;

  await db.transaction(async (tx) => {
    if (isBounty && eliminatedByPlayerIds && eliminatedByPlayerIds.length > 0) {
      const bountyTxs = computeBountyDistribution(
        participant.id,
        participant.currentBounty,
        eliminatedByPlayerIds,
        participant.tournamentId
      );

      if (bountyTxs.length > 0) {
        await tx.insert(transactions).values(bountyTxs);

        const eliminatorParticipants = await tx
          .select({ id: participants.id, playerId: participants.playerId, currentBounty: participants.currentBounty, bountiesCollected: participants.bountiesCollected })
          .from(participants)
          .where(
            and(
              eq(participants.tournamentId, participant.tournamentId),
              inArray(participants.playerId, eliminatedByPlayerIds)
            )
          );

        for (const ep of eliminatorParticipants) {
          const tx_ = bountyTxs.find((b) => b.playerId === ep.playerId);
          if (tx_) {
            await tx
              .update(participants)
              .set({
                currentBounty: ep.currentBounty + tx_.bountyChange,
                bountiesCollected: ep.bountiesCollected + tx_.amount,
              })
              .where(eq(participants.id, ep.id));
          }
        }
      }
    }

    await tx
      .update(participants)
      .set({
        rebuyCount: participant.rebuyCount + 1,
        currentBounty: isBounty ? newBounty : participant.currentBounty,
        eliminatedByIds: isBounty ? (eliminatedByPlayerIds ?? []) : participant.eliminatedByIds,
      })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values({
      tournamentId: participant.tournamentId,
      playerId: participant.playerId,
      type: "rebuy",
      amount: tournament.rebuyAmount,
    });
  });

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function addDoubleRebuy(participantId: number, eliminatedByPlayerIds?: number[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (!participant.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };

  const [tournament] = await db
    .select({
      rebuyAmount: tournaments.rebuyAmount,
      maxRebuys: tournaments.maxRebuys,
      tournamentType: tournaments.tournamentType,
      bountyPercentage: tournaments.bountyPercentage,
    })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  if (tournament.rebuyAmount === 0) return { error: "Torneio nao permite rebuy" };
  if (tournament.maxRebuys > 0 && participant.rebuyCount + 2 > tournament.maxRebuys) {
    return { error: `Limite de rebuys atingido (max: ${tournament.maxRebuys})` };
  }

  const isBounty = tournament.tournamentType === "bounty_builder";
  if (isBounty && (!eliminatedByPlayerIds || eliminatedByPlayerIds.length === 0)) {
    return { error: "Selecione quem eliminou o jogador" };
  }

  const newBounty = isBounty
    ? Math.floor((tournament.rebuyAmount * tournament.bountyPercentage) / 100)
    : 0;

  await db.transaction(async (tx) => {
    if (isBounty && eliminatedByPlayerIds && eliminatedByPlayerIds.length > 0) {
      const bountyTxs = computeBountyDistribution(
        participant.id,
        participant.currentBounty,
        eliminatedByPlayerIds,
        participant.tournamentId
      );

      if (bountyTxs.length > 0) {
        await tx.insert(transactions).values(bountyTxs);

        const eliminatorParticipants = await tx
          .select({ id: participants.id, playerId: participants.playerId, currentBounty: participants.currentBounty, bountiesCollected: participants.bountiesCollected })
          .from(participants)
          .where(
            and(
              eq(participants.tournamentId, participant.tournamentId),
              inArray(participants.playerId, eliminatedByPlayerIds)
            )
          );

        for (const ep of eliminatorParticipants) {
          const tx_ = bountyTxs.find((b) => b.playerId === ep.playerId);
          if (tx_) {
            await tx
              .update(participants)
              .set({
                currentBounty: ep.currentBounty + tx_.bountyChange,
                bountiesCollected: ep.bountiesCollected + tx_.amount,
              })
              .where(eq(participants.id, ep.id));
          }
        }
      }
    }

    await tx
      .update(participants)
      .set({
        rebuyCount: participant.rebuyCount + 2,
        currentBounty: isBounty ? newBounty : participant.currentBounty,
        eliminatedByIds: isBounty ? (eliminatedByPlayerIds ?? []) : participant.eliminatedByIds,
      })
      .where(eq(participants.id, participantId));

    await tx.insert(transactions).values([
      {
        tournamentId: participant.tournamentId,
        playerId: participant.playerId,
        type: "rebuy",
        amount: tournament.rebuyAmount,
      },
      {
        tournamentId: participant.tournamentId,
        playerId: participant.playerId,
        type: "rebuy",
        amount: tournament.rebuyAmount,
      },
    ]);
  });

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function addAddon(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (!participant.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };

  const [tournament] = await db
    .select({ allowAddon: tournaments.allowAddon, addonAmount: tournaments.addonAmount })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

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

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function undoRebuy(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.rebuyCount <= 0) return { error: "Nenhum rebuy para desfazer" };
  if (participant.status !== "playing") {
    return { error: "Desfaca a eliminacao antes de desfazer o rebuy" };
  }

  const [tournament] = await db
    .select({ tournamentType: tournaments.tournamentType, bountyPercentage: tournaments.bountyPercentage, rebuyAmount: tournaments.rebuyAmount })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  const isBounty = tournament.tournamentType === "bounty_builder";

  const [lastRebuyTx] = await db
    .select({ id: transactions.id, createdAt: CREATED_AT_TEXT })
    .from(transactions)
    .where(
      and(
        eq(transactions.playerId, participant.playerId),
        eq(transactions.tournamentId, participant.tournamentId),
        eq(transactions.type, "rebuy")
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  await db.transaction(async (tx) => {
    if (lastRebuyTx) {
      await tx.delete(transactions).where(eq(transactions.id, lastRebuyTx.id));
    }

    // Para duplo rebuy: ambas as transações têm o mesmo timestamp.
    // Só revertemos o bounty quando não restar outra rebuy no mesmo timestamp
    // (ou seja, no segundo undo do duplo rebuy, não no primeiro).
    const siblingRebuy = lastRebuyTx
      ? await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.playerId, participant.playerId),
              eq(transactions.tournamentId, participant.tournamentId),
              eq(transactions.type, "rebuy"),
              sameCreatedAt(lastRebuyTx.createdAt)
            )
          )
          .limit(1)
      : [];

    const isDoubleRebuyFirstUndo = siblingRebuy.length > 0;

    if (isBounty && lastRebuyTx && !isDoubleRebuyFirstUndo) {
      const bountyTxs = await tx
        .select({ id: transactions.id, playerId: transactions.playerId, amount: transactions.amount, bountyChange: transactions.bountyChange })
        .from(transactions)
        .where(
          and(
            eq(transactions.tournamentId, participant.tournamentId),
            eq(transactions.type, "bounty_earned"),
            eq(transactions.relatedParticipantId, participant.id),
            sameCreatedAt(lastRebuyTx.createdAt)
          )
        );

      if (bountyTxs.length > 0) {
        const eliminatorPlayerIds = bountyTxs.map((b) => b.playerId);
        const eliminatorParticipants = await tx
          .select({ id: participants.id, playerId: participants.playerId, currentBounty: participants.currentBounty, bountiesCollected: participants.bountiesCollected })
          .from(participants)
          .where(
            and(
              eq(participants.tournamentId, participant.tournamentId),
              inArray(participants.playerId, eliminatorPlayerIds)
            )
          );

        for (const ep of eliminatorParticipants) {
          const btx = bountyTxs.find((b) => b.playerId === ep.playerId);
          if (btx) {
            await tx
              .update(participants)
              .set({
                currentBounty: Math.max(0, ep.currentBounty - btx.bountyChange),
                bountiesCollected: Math.max(0, ep.bountiesCollected - btx.amount),
              })
              .where(eq(participants.id, ep.id));
          }
        }

        const oldBounty = bountyTxs.reduce((sum, b) => sum + b.amount + b.bountyChange, 0);

        await tx.delete(transactions).where(
          and(
            eq(transactions.tournamentId, participant.tournamentId),
            eq(transactions.type, "bounty_earned"),
            eq(transactions.relatedParticipantId, participant.id),
            sameCreatedAt(lastRebuyTx.createdAt)
          )
        );

        await tx
          .update(participants)
          .set({
            rebuyCount: participant.rebuyCount - 1,
            currentBounty: oldBounty,
            eliminatedByIds: [],
          })
          .where(eq(participants.id, participantId));

        return;
      }
    }

    await tx
      .update(participants)
      .set({ rebuyCount: participant.rebuyCount - 1 })
      .where(eq(participants.id, participantId));
  });

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function undoAddon(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
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

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function addBonusChip(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (participant.bonusChipUsed) return { error: "Bonus chip ja utilizado" };

  const [tournament] = await db
    .select({ bonusChipAmount: tournaments.bonusChipAmount })
    .from(tournaments)
    .where(eq(tournaments.id, participant.tournamentId));

  if (!tournament || tournament.bonusChipAmount === 0) return { error: "Torneio nao permite bonus chip" };

  await db
    .update(participants)
    .set({ bonusChipUsed: true })
    .where(eq(participants.id, participantId));

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function undoBonusChip(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };
  if (!participant.bonusChipUsed) return { error: "Bonus chip nao foi utilizado" };

  await db
    .update(participants)
    .set({ bonusChipUsed: false })
    .where(eq(participants.id, participantId));

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

// Pausa o timer quando a eliminação final coroa o campeão; fica na action
// porque o relógio do torneio não pertence ao Ledger de Knockout.
async function pauseTimerAtEnd(tx: LedgerExecutor, tournamentId: number) {
  const [t] = await tx
    .select({ timerRunning: tournaments.timerRunning, timerRemainingSecs: tournaments.timerRemainingSecs, timerStartedAt: tournaments.timerStartedAt })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (t?.timerRunning && t.timerStartedAt) {
    const elapsed = Math.floor((Date.now() - new Date(t.timerStartedAt).getTime()) / 1000);
    const remaining = Math.max(0, (t.timerRemainingSecs ?? 0) - elapsed);
    await tx
      .update(tournaments)
      .set({ timerRunning: false, timerStartedAt: null, timerRemainingSecs: remaining, updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
  }
}

export async function eliminatePlayer(participantId: number, eliminatedByPlayerIds?: number[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };

  const snapshot = await loadKnockoutSnapshot(db, participant.tournamentId);
  if (!snapshot) return { error: "Torneio nao encontrado" };

  const event: KnockoutEvent = { kind: "elimination", victimId: participantId, eliminatorPlayerIds: eliminatedByPlayerIds ?? [] };
  const refused = checkKnockout(snapshot, event);
  if (refused) return refused;

  try {
    await db.transaction(async (tx) => {
      const { crowned } = await applyKnockout(tx, participant.tournamentId, event);
      if (crowned) await pauseTimerAtEnd(tx, participant.tournamentId);
    });
  } catch (e) {
    if (e instanceof KnockoutLedgerError) return { error: e.message };
    throw e;
  }

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
  return { success: true };
}

export async function undoElimination(participantId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Participante nao encontrado" };

  const snapshot = await loadKnockoutSnapshot(db, participant.tournamentId);
  if (!snapshot) return { error: "Torneio nao encontrado" };

  const req: UndoRequest = { kind: "elimination", victimId: participantId };
  const refused = checkUndo(snapshot, req);
  if (refused) return refused;

  try {
    await db.transaction((tx) => undoKnockout(tx, participant.tournamentId, req));
  } catch (e) {
    if (e instanceof KnockoutLedgerError) return { error: e.message };
    throw e;
  }

  revalidatePath(`/torneios/${participant.tournamentId}`, "layout");
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

  revalidatePath(`/torneios/${tournamentId}`, "layout");
  return { success: true };
}

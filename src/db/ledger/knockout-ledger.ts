// Adapter do Ledger de Knockout: persistência de eventos ligada à transação do
// chamador. Sem auth, sem revalidate, nunca abre a própria transação.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { participants, tournaments, transactions } from "@/db/schema";
import {
  planKnockout,
  planUndo,
  LedgerStateChangedError,
  type KnockoutEvent,
  type KnockoutPlan,
  type LedgerSnapshot,
  type UndoRequest,
} from "@/lib/knockout-ledger";

export type LedgerExecutor = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function loadKnockoutSnapshot(executor: LedgerExecutor, tournamentId: number): Promise<LedgerSnapshot | null> {
  const [rules] = await executor
    .select({
      tournamentType: tournaments.tournamentType,
      buyInAmount: tournaments.buyInAmount,
      rankingFeeAmount: tournaments.rankingFeeAmount,
      rebuyAmount: tournaments.rebuyAmount,
      maxRebuys: tournaments.maxRebuys,
      bountyPercentage: tournaments.bountyPercentage,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!rules) return null;

  const parts = await executor
    .select({
      id: participants.id,
      playerId: participants.playerId,
      status: participants.status,
      buyInPaid: participants.buyInPaid,
      finishPosition: participants.finishPosition,
      rebuyCount: participants.rebuyCount,
      currentBounty: participants.currentBounty,
      bountiesCollected: participants.bountiesCollected,
      eliminatedByIds: participants.eliminatedByIds,
    })
    .from(participants)
    .where(eq(participants.tournamentId, tournamentId))
    .orderBy(participants.id);

  // created_at é timestamptz com microssegundos; lido como texto para que a
  // identidade do evento (ADR 0001) nunca passe por um Date de milissegundos.
  const rows = await executor
    .select({
      id: transactions.id,
      playerId: transactions.playerId,
      type: sql<"bounty_earned" | "rebuy">`${transactions.type}`,
      amount: transactions.amount,
      bountyChange: transactions.bountyChange,
      relatedParticipantId: transactions.relatedParticipantId,
      createdAt: sql<string>`${transactions.createdAt}::text`,
    })
    .from(transactions)
    .where(and(eq(transactions.tournamentId, tournamentId), inArray(transactions.type, ["bounty_earned", "rebuy"])))
    .orderBy(transactions.id);

  return { rules, participants: parts, rows, now: new Date() };
}

// Serializa os Knockouts de um torneio: dois admins disparando a mesma
// eliminação entram aqui em fila, e o segundo relê o snapshot já alterado.
async function lockTournament(tx: LedgerExecutor, tournamentId: number) {
  await tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).for("update");
}

// Carimbo único do evento, estritamente maior que qualquer linha já gravada no
// torneio: dois eventos nunca compartilham created_at nem em pglite.
async function nextStamp(tx: LedgerExecutor, tournamentId: number, now: Date) {
  const [last] = await tx
    .select({ createdAt: transactions.createdAt })
    .from(transactions)
    .where(eq(transactions.tournamentId, tournamentId))
    .orderBy(desc(transactions.createdAt))
    .limit(1);
  const floor = last ? last.createdAt.getTime() + 1 : 0;
  return new Date(Math.max(now.getTime(), floor));
}

async function applyPlan(tx: LedgerExecutor, tournamentId: number, plan: KnockoutPlan, stamp: Date) {
  if (plan.inserts.length > 0) {
    await tx.insert(transactions).values(plan.inserts.map((r) => ({ ...r, tournamentId, createdAt: stamp })));
  }
  if (plan.deleteIds.length > 0) {
    await tx.delete(transactions).where(inArray(transactions.id, plan.deleteIds));
  }
  for (const patch of plan.patches) {
    await tx.update(participants).set(patch.set).where(eq(participants.id, patch.participantId));
  }
}

export async function applyKnockout(tx: LedgerExecutor, tournamentId: number, event: KnockoutEvent) {
  await lockTournament(tx, tournamentId);
  const snapshot = await loadKnockoutSnapshot(tx, tournamentId);
  if (!snapshot) throw new LedgerStateChangedError();
  const stamp = await nextStamp(tx, tournamentId, snapshot.now);
  const plan = planKnockout({ ...snapshot, now: stamp }, event);
  await applyPlan(tx, tournamentId, plan, stamp);
  return { crowned: plan.crowned };
}

export async function undoKnockout(tx: LedgerExecutor, tournamentId: number, req: UndoRequest) {
  await lockTournament(tx, tournamentId);
  const snapshot = await loadKnockoutSnapshot(tx, tournamentId);
  if (!snapshot) throw new LedgerStateChangedError();
  const plan = planUndo(snapshot, req);
  await applyPlan(tx, tournamentId, plan, snapshot.now);
  return { uncrowned: plan.uncrowned };
}

import { db } from "@/db";
import { transactions, players, participants } from "@/db/schema";
import { and, eq, sum } from "drizzle-orm";
import type { LedgerExecutor } from "@/db/ledger/knockout-ledger";

export async function getTransactions(tournamentId: number) {
  return db
    .select({
      id: transactions.id,
      playerId: transactions.playerId,
      name: players.name,
      nickname: players.nickname,
      type: transactions.type,
      amount: transactions.amount,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(players, eq(transactions.playerId, players.id))
    .where(eq(transactions.tournamentId, tournamentId))
    .orderBy(transactions.createdAt);
}

// executor: a transação do chamador quando precisa ler o estado já alterado dentro dela.
export async function getTournamentFinancialSummary(tournamentId: number, executor: LedgerExecutor = db) {
  const rows = await executor
    .select({
      type: transactions.type,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(eq(transactions.tournamentId, tournamentId))
    .groupBy(transactions.type);

  const summary = { buy_in: 0, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 };
  for (const row of rows) {
    if (row.type in summary) {
      summary[row.type as keyof typeof summary] = Number(row.total ?? 0);
    }
  }
  return summary;
}

// Prêmios pagos a cada Participante, lidos dos registros de Prêmio (refazer a
// distribuição os substitui). Nunca do Prêmio guardado no participante, que fica
// velho quando uma redistribuição tira alguém da lista.
export async function getPaidPrizesByParticipant(tournamentId: number) {
  const rows = await db
    .select({ participantId: participants.id, amount: sum(transactions.amount) })
    .from(transactions)
    .innerJoin(
      participants,
      and(eq(participants.tournamentId, transactions.tournamentId), eq(participants.playerId, transactions.playerId))
    )
    .where(and(eq(transactions.tournamentId, tournamentId), eq(transactions.type, "prize")))
    .groupBy(participants.id)
    .orderBy(participants.id);
  return rows.map((r) => ({ participantId: r.participantId, amount: Number(r.amount ?? 0) }));
}

// O Jogador tem Prêmio pago neste torneio, lido dos registros de Prêmio e não
// do Prêmio guardado no participante (aceita a transação do chamador).
export async function hasPaidPrize(tournamentId: number, playerId: number, executor: LedgerExecutor = db) {
  const [row] = await executor
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.tournamentId, tournamentId),
        eq(transactions.playerId, playerId),
        eq(transactions.type, "prize")
      )
    )
    .limit(1);
  return Boolean(row);
}

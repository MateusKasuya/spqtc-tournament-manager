import { db } from "@/db";
import { transactions, players } from "@/db/schema";
import { eq, sum } from "drizzle-orm";

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

export async function getTournamentFinancialSummary(tournamentId: number) {
  const rows = await db
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

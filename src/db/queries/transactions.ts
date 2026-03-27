import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, sum } from "drizzle-orm";

export async function getTransactions(tournamentId: number) {
  return db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      name: users.name,
      nickname: users.nickname,
      type: transactions.type,
      amount: transactions.amount,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
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

  const summary = { buy_in: 0, rebuy: 0, addon: 0, prize: 0 };
  for (const row of rows) {
    summary[row.type as keyof typeof summary] = Number(row.total ?? 0);
  }
  return summary;
}

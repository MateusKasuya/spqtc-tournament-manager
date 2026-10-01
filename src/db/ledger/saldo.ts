// Adapter do Saldo: lê, na transação do chamador, o estado financeiro do torneio
// e recusa o que deixaria o Saldo negativo. Sem auth, sem revalidate, nunca abre transação.
import { eq } from "drizzle-orm";
import { participants, tournaments } from "@/db/schema";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { formatCurrency } from "@/lib/format";
import { computePrizePool, computeSaldo, SaldoNegativoError, type PrizePool } from "@/lib/prize-pool";
import type { LedgerExecutor } from "@/db/ledger/knockout-ledger";

export async function loadPrizePool(executor: LedgerExecutor, tournamentId: number): Promise<PrizePool & { prizesPaid: number }> {
  const [rules] = await executor
    .select({ tournamentType: tournaments.tournamentType, rankingFeeAmount: tournaments.rankingFeeAmount })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!rules) throw new Error(`Torneio ${tournamentId} nao encontrado`);

  const parts = await executor
    .select({
      buyInPaid: participants.buyInPaid,
      currentBounty: participants.currentBounty,
      bountiesCollected: participants.bountiesCollected,
    })
    .from(participants)
    .where(eq(participants.tournamentId, tournamentId));

  const totals = await getTournamentFinancialSummary(tournamentId, executor);

  const pool = computePrizePool({ rules, collected: totals, participants: parts });
  return { ...pool, prizesPaid: totals.prize };
}

// Chamar depois de aplicar o Desfazer, ainda dentro da transação: lança e a transação desfaz tudo.
export async function assertSaldoNaoNegativo(executor: LedgerExecutor, tournamentId: number) {
  const { prizePool, prizesPaid } = await loadPrizePool(executor, tournamentId);
  if (computeSaldo(prizePool, prizesPaid) < 0) {
    throw new SaldoNegativoError(
      `Desfazer deixaria o Saldo negativo: Premios pagos de ${formatCurrency(prizesPaid)} acima do Prize pool de ${formatCurrency(prizePool)}. Refaca a distribuicao de premios antes`
    );
  }
}

// Distribuir prêmios: o total novo substitui os Prêmios pagos, então é ele que cabe no Prize pool.
export async function assertPremiosCabemNoPrizePool(executor: LedgerExecutor, tournamentId: number, total: number) {
  const { prizePool } = await loadPrizePool(executor, tournamentId);
  if (computeSaldo(prizePool, total) < 0) {
    throw new SaldoNegativoError(
      `Premios somam ${formatCurrency(total)}, acima do Prize pool de ${formatCurrency(prizePool)}`
    );
  }
}

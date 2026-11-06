import { formatCurrency } from "@/lib/format";
import { isBountyBuilder } from "@/lib/knockout-ledger";
import { computePrizePool, computeSaldo } from "@/lib/prize-pool";
import type { MesaSnapshot } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";

// A conta do Prize pool (CONTEXT.md, cluster Prêmios), em centavos. Os valores de
// cada origem são o que entrou de fato no torneio (o resumo financeiro), nunca a
// contagem vezes o valor atual da configuração.
export interface PrizePoolPanel {
  buyIns: number;
  rebuys: number;
  addons: number;
  collected: number;
  rankingFund: number;
  // Só em Bounty Builder; `null` esconde a linha.
  bountyAllocated: number | null;
  prizePool: number;
  // Só quando há Prêmios pagos; `null` esconde as linhas de Prêmios pagos e Saldo.
  // O Saldo aparece como está, mesmo negativo (#73).
  prizesPaid: { total: number; balance: number } | null;
}

// Há Prêmios pagos quando o total de Prêmios pagos do resumo financeiro passa de
// zero. Nunca pelo valor de Prêmio guardado no participante, que fica velho numa
// redistribuição. É a condição única de "há Prêmios pagos" para todos os painéis.
export function hasPrizesPaid({ financialSummary }: Pick<MesaSnapshot, "financialSummary">): boolean {
  return financialSummary.prize > 0;
}

export interface PrizePoolSlice {
  card: CardFace;
  panel: PrizePoolPanel;
}

export function derivePrizePool({ snapshot }: MesaPanelsInput): PrizePoolSlice {
  const { tournament, financialSummary } = snapshot;
  const pool = computePrizePool({
    rules: tournament,
    collected: financialSummary,
    participants: snapshot.participants,
  });
  const panel: PrizePoolPanel = {
    buyIns: financialSummary.buy_in,
    rebuys: financialSummary.rebuy,
    addons: financialSummary.addon,
    collected: pool.collected,
    rankingFund: pool.rankingFund,
    bountyAllocated: isBountyBuilder(tournament) ? pool.bountyAllocated : null,
    prizePool: pool.prizePool,
    prizesPaid: hasPrizesPaid(snapshot)
      ? { total: financialSummary.prize, balance: computeSaldo(pool.prizePool, financialSummary.prize) }
      : null,
  };
  return {
    card: { label: "Prize pool", value: formatCurrency(panel.prizePool), supportLines: [] },
    panel,
  };
}

// Núcleo puro do Prize pool (CONTEXT.md, cluster Prêmios).
// Prize pool = Arrecadado − Fundo de ranking − Bounty armado, em centavos.
// Sem banco: a página chama no servidor, a mesa ao vivo chama no cliente.

import { isBountyBuilder, type LedgerRules } from "@/lib/knockout-ledger";

export interface PrizePoolParticipant {
  buyInPaid: boolean;
  currentBounty: number;
  bountiesCollected: number;
}

export interface PrizePoolInput {
  rules: Pick<LedgerRules, "tournamentType" | "rankingFeeAmount">;
  collected: { buy_in: number; rebuy: number; addon: number };
  participants: PrizePoolParticipant[];
}

export interface PrizePool {
  collected: number;
  rankingFund: number;
  bountyAllocated: number;
  prizePool: number;
}

export function computePrizePool({ rules, collected, participants }: PrizePoolInput): PrizePool {
  const total = collected.buy_in + collected.rebuy + collected.addon;
  // Só buy-in confirmado paga taxa de ranking; Rebuy e add-on não contribuem.
  const rankingFund = rules.rankingFeeAmount * participants.filter((p) => p.buyInPaid).length;
  // Pela Conservação, em jogo + coletado é o total de Bounty criado, invariante a Knockout e Desfazer.
  const bountyAllocated = isBountyBuilder(rules)
    ? participants.reduce((sum, p) => sum + p.currentBounty + p.bountiesCollected, 0)
    : 0;
  return { collected: total, rankingFund, bountyAllocated, prizePool: total - rankingFund - bountyAllocated };
}

// Saldo: Prize pool menos Prêmios pagos. Negativo é estado proibido (CONTEXT.md).
export function computeSaldo(prizePool: number, prizesPaid: number): number {
  return prizePool - prizesPaid;
}

// Recusa esperada: um Desfazer deixaria o Saldo negativo. A action devolve a mensagem como { error }.
export class SaldoNegativoError extends Error {}

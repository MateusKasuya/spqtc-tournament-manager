import { formatCurrency } from "@/lib/format";
import { isBountyBuilder } from "@/lib/knockout-ledger";
import { computePrizePool, computeSaldo } from "@/lib/prize-pool";
import { calculateRoundedPrizeAmounts } from "@/lib/prize";
import type { MesaSnapshot } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";
import { countPrizedPositions, deriveMoneyLine, isPrizedPosition, type MoneyLine } from "./money-line";

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
  // `null` é o estado vazio da seção: sem Estrutura ou sem Posições premiadas.
  structure: PrizeStructureSection | null;
  moneyLine: MoneyLine | null;
  // Só No dinheiro com 2 ou mais Em jogo.
  nextOut: { position: number; prize: number } | null;
  // Aviso só para o admin. A mesa só avisa: não recorta nem renormaliza a Estrutura.
  prizedPositionsAboveBuyIns: { prizedPositions: number; buyIns: number } | null;
}

export interface EstimatedPrizePosition {
  position: number;
  percentage: number;
  estimatedPrize: number;
}

export interface PrizeStructureSection {
  positions: EstimatedPrizePosition[];
  // Última posição com percentual maior que zero: a linha até onde paga fica abaixo dela.
  paysThroughPosition: number;
}

// Prêmio estimado de cada posição da Estrutura, com o mesmo arredondamento de
// Prêmios da página do torneio (todas as posições, inclusive as de 0%, para o
// resto cair igual), nunca percentual × Prize pool.
export function estimatePrizes(
  prizeStructure: MesaSnapshot["prizeStructure"],
  prizePool: number
): EstimatedPrizePosition[] {
  const amounts = calculateRoundedPrizeAmounts(prizePool, prizeStructure.map((p) => p.percentage));
  return prizeStructure.map((p, i) => ({ ...p, estimatedPrize: amounts[i] }));
}

function buildStructureSection(positions: EstimatedPrizePosition[]): PrizeStructureSection | null {
  const prized = positions.filter(isPrizedPosition);
  if (prized.length === 0) return null;
  return { positions, paysThroughPosition: prized[prized.length - 1].position };
}

function deriveNextOut(moneyLine: MoneyLine | null, positions: EstimatedPrizePosition[]) {
  if (moneyLine?.state !== "inTheMoney" || moneyLine.playing < 2) return null;
  const position = moneyLine.playing;
  return { position, prize: positions.find((p) => p.position === position)?.estimatedPrize ?? 0 };
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

function derivePrizedPositionsAboveBuyIns({ snapshot, isAdmin }: MesaPanelsInput) {
  if (!isAdmin) return null;
  const prizedPositions = countPrizedPositions(snapshot.prizeStructure);
  const buyIns = snapshot.participants.filter((p) => p.buyInPaid).length;
  return prizedPositions > buyIns ? { prizedPositions, buyIns } : null;
}

export function derivePrizePool(input: MesaPanelsInput): PrizePoolSlice {
  const { snapshot } = input;
  const { tournament, financialSummary } = snapshot;
  const pool = computePrizePool({
    rules: tournament,
    collected: financialSummary,
    participants: snapshot.participants,
  });
  const estimated = estimatePrizes(snapshot.prizeStructure, pool.prizePool);
  const moneyLine = deriveMoneyLine(snapshot);
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
    structure: buildStructureSection(estimated),
    moneyLine,
    nextOut: deriveNextOut(moneyLine, estimated),
    prizedPositionsAboveBuyIns: derivePrizedPositionsAboveBuyIns(input),
  };
  const first = panel.structure?.positions.find((p) => p.position === 1);
  return {
    card: {
      label: "Prize pool",
      value: formatCurrency(panel.prizePool),
      supportLines: first ? [`1º ${formatCurrency(first.estimatedPrize)}`] : [],
    },
    panel,
  };
}

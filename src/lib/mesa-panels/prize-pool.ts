import { formatCurrency } from "@/lib/format";
import { isBountyBuilder } from "@/lib/knockout-ledger";
import { computePrizePool, computeSaldo } from "@/lib/prize-pool";
import { calculateRoundedPrizeAmounts } from "@/lib/prize";
import type { MesaPrizePosition } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";
import { countPrizedPositions, deriveMoneyLine, moneyBoundary, type MoneyLine } from "./money-line";
import { derivePrizesPaid, type PaidPrizeEntry } from "./prizes-paid";
import { countWithBuyIn } from "./playing";

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
  // O total é o da lista por Participante (`derivePrizesPaid`), o mesmo da tabela.
  // O Saldo aparece como está, mesmo negativo (#73).
  prizesPaid: { total: number; balance: number } | null;
  // Tabela de Prêmios estimados; `null` com Prêmios pagos (a lista deles a
  // substitui) ou, sem eles, o estado vazio: sem Estrutura ou sem Posições premiadas.
  structure: PrizeStructureSection | null;
  // Só quando há Prêmios pagos: substituem a tabela de Prêmios estimados.
  paidPrizesByPosition: PaidPrizeEntry[] | null;
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
  // A fronteira do dinheiro: a linha até onde paga fica abaixo dela; 0 sem linha.
  paysThroughPosition: number;
}

// Prêmio estimado de cada posição da Estrutura, com o mesmo arredondamento de
// Prêmios da página do torneio (todas as posições, inclusive as de 0%, para o
// resto cair igual), nunca percentual × Prize pool.
export function estimatePrizes(
  prizeStructure: MesaPrizePosition[],
  prizePool: number
): EstimatedPrizePosition[] {
  const amounts = calculateRoundedPrizeAmounts(prizePool, prizeStructure.map((p) => p.percentage));
  return prizeStructure.map((p, i) => ({ ...p, estimatedPrize: amounts[i] }));
}

function buildStructureSection(positions: EstimatedPrizePosition[]): PrizeStructureSection | null {
  if (countPrizedPositions(positions) === 0) return null;
  return { positions, paysThroughPosition: moneyBoundary(positions) };
}

function deriveNextOut(moneyLine: MoneyLine | null, positions: EstimatedPrizePosition[]) {
  if (moneyLine?.state !== "inTheMoney" || moneyLine.playing < 2) return null;
  const position = moneyLine.playing;
  return { position, prize: positions.find((p) => p.position === position)?.estimatedPrize ?? 0 };
}

export interface PrizePoolSlice {
  card: CardFace;
  panel: PrizePoolPanel;
}

function derivePrizedPositionsAboveBuyIns({ snapshot, isAdmin }: MesaPanelsInput) {
  if (!isAdmin) return null;
  const prizedPositions = countPrizedPositions(snapshot.prizeStructure);
  const buyIns = countWithBuyIn(snapshot.participants);
  return prizedPositions > buyIns ? { prizedPositions, buyIns } : null;
}

// Face "1º R$ X": com Prêmios pagos, o de quem tem Posição final 1 (nunca o
// estimado); sem eles, o Prêmio estimado da 1ª posição. `null` esconde a linha.
function deriveFirstPrize({ paidPrizesByPosition, structure }: PrizePoolPanel): number | null {
  if (paidPrizesByPosition) return paidPrizesByPosition.find((p) => p.finishPosition === 1)?.amount ?? null;
  return structure?.positions.find((p) => p.position === 1)?.estimatedPrize ?? null;
}

export function derivePrizePool(input: MesaPanelsInput): PrizePoolSlice {
  const { snapshot } = input;
  const { tournament, financialSummary } = snapshot;
  const pool = computePrizePool({
    rules: tournament,
    collected: financialSummary,
    participants: snapshot.participants,
  });
  const paid = derivePrizesPaid(snapshot);
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
    prizesPaid: paid
      ? { total: paid.total, balance: computeSaldo(pool.prizePool, paid.total) }
      : null,
    structure: paid ? null : buildStructureSection(estimated),
    paidPrizesByPosition: paid ? paid.byPosition : null,
    moneyLine,
    nextOut: deriveNextOut(moneyLine, estimated),
    prizedPositionsAboveBuyIns: derivePrizedPositionsAboveBuyIns(input),
  };
  const firstPrize = deriveFirstPrize(panel);
  return {
    card: {
      label: "Prize pool",
      value: formatCurrency(panel.prizePool),
      supportLines: firstPrize === null ? [] : [`1º ${formatCurrency(firstPrize)}`],
    },
    panel,
  };
}

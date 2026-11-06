import type { MesaSnapshot } from "@/db/queries/mesa";

// A fronteira do dinheiro (CONTEXT.md: Posições premiadas, Bolha, No dinheiro).
// É a única conta dela: o painel do Prize pool e o Jogadores (#84) a leem daqui.

// Posições da Estrutura de prêmios com percentual maior que zero.
export function countPaidPositions(prizeStructure: MesaSnapshot["prizeStructure"]): number {
  return prizeStructure.filter((p) => p.percentage > 0).length;
}

// `beforeMoney`: faltam 2 ou mais Eliminações; `bubble`: falta uma (Bolha);
// `inTheMoney`: Em jogo não passa das Posições premiadas (No dinheiro).
export type MoneyLineState = "beforeMoney" | "bubble" | "inTheMoney";

export interface MoneyLine {
  paidPositions: number;
  // Participantes Em jogo.
  playing: number;
  // "faltam K" = Em jogo − Posições premiadas; zero ou negativo No dinheiro.
  remaining: number;
  state: MoneyLineState;
}

// `null` quando não há linha de dinheiro: ninguém Em jogo (antes do primeiro
// buy-in ou depois da Coroação) ou Estrutura sem Posições premiadas.
export function deriveMoneyLine({ participants, prizeStructure }: Pick<MesaSnapshot, "participants" | "prizeStructure">): MoneyLine | null {
  const playing = participants.filter((p) => p.status === "playing").length;
  const paidPositions = countPaidPositions(prizeStructure);
  if (playing === 0 || paidPositions === 0) return null;
  const remaining = playing - paidPositions;
  const state: MoneyLineState = remaining <= 0 ? "inTheMoney" : remaining === 1 ? "bubble" : "beforeMoney";
  return { paidPositions, playing, remaining, state };
}

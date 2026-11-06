import type { MesaParticipant, MesaPrizePosition } from "@/db/queries/mesa";
import { countPlaying } from "./playing";

// A Fronteira do dinheiro (CONTEXT.md: Posições premiadas, Bolha, No dinheiro), a
// única conta dela: o painel do Prize pool e o Jogadores (#84) a leem daqui.
// O #85 desliga a linha com Prêmios pagos aqui dentro, com `hasPrizesPaid` de
// `./prizes-paid` (que não importa este arquivo).

export function isPrizedPosition(position: MesaPrizePosition): boolean {
  return position.percentage > 0;
}

export function countPrizedPositions(prizeStructure: MesaPrizePosition[]): number {
  return prizeStructure.filter(isPrizedPosition).length;
}

// Última posição com Prêmio garantido: o fim da sequência de Posições premiadas a
// partir do 1º. Sem posição de 0% no meio, é o número de Posições premiadas; com
// ela (o editor aceita), quem cai no buraco não leva Prêmio, então o dinheiro para
// antes dele. 0 quando o 1º não é premiado.
export function moneyBoundary(prizeStructure: MesaPrizePosition[]): number {
  let boundary = 0;
  for (const p of prizeStructure) {
    if (p.position !== boundary + 1 || !isPrizedPosition(p)) break;
    boundary++;
  }
  return boundary;
}

// `beforeMoney`: faltam 2 ou mais Eliminações; `bubble`: falta uma (Bolha);
// `inTheMoney`: Em jogo não passa da fronteira (No dinheiro).
export type MoneyLineState = "beforeMoney" | "bubble" | "inTheMoney";

export interface MoneyLine {
  // "Pagam N": a fronteira do dinheiro.
  paysThrough: number;
  playing: number;
  // "faltam K" = Em jogo − fronteira; zero ou negativo No dinheiro.
  remaining: number;
  state: MoneyLineState;
}

// `null` sem ninguém Em jogo (antes do primeiro buy-in ou depois da Coroação) ou
// sem fronteira (sem Estrutura, sem Posições premiadas ou com o 1º em 0%).
export function deriveMoneyLine({ participants, prizeStructure }: {
  participants: MesaParticipant[];
  prizeStructure: MesaPrizePosition[];
}): MoneyLine | null {
  const playing = countPlaying(participants);
  const paysThrough = moneyBoundary(prizeStructure);
  if (playing === 0 || paysThrough === 0) return null;
  const remaining = playing - paysThrough;
  const state: MoneyLineState = remaining <= 0 ? "inTheMoney" : remaining === 1 ? "bubble" : "beforeMoney";
  return { paysThrough, playing, remaining, state };
}

// Módulo puro dos painéis da Mesa ao vivo (spec #75): recebe o snapshot da mesa,
// o Tempo restante e se quem vê é admin, e devolve o modelo de visão com a face
// de cada card e o conteúdo de cada painel. Os componentes só desenham.
//
// Cada painel tem a própria derivação, num arquivo deste diretório, que exporta o
// tipo `XxxSlice` e a função `deriveXxx`. Este arquivo já liga os seis: um painel
// novo só edita o próprio arquivo. `panel: null` quer dizer que o painel ainda não
// existe e o card não abre gaveta. Conta que mais de um painel usa mora num arquivo
// próprio, sem slice: `money-line.ts` (a fronteira do dinheiro) e `prizes-paid.ts`
// (há Prêmios pagos).

import { deriveAverageStack, type AverageStackSlice } from "./average-stack";
import { deriveBounty, type BountySlice } from "./bounty";
import { deriveChipsInPlay, type ChipsInPlaySlice } from "./chips-in-play";
import { deriveLevel, type LevelSlice } from "./level";
import { derivePlayers, type PlayersSlice } from "./players";
import { derivePrizePool, type PrizePoolSlice } from "./prize-pool";
import type { MesaPanelsInput } from "./types";

export * from "./types";

export * from "./players";

export * from "./average-stack";

export * from "./chips-in-play";

export * from "./prize-pool";

export * from "./money-line";

export * from "./prizes-paid";

export * from "./bounty";

export * from "./level";

export interface MesaPanelsView {
  players: PlayersSlice;
  averageStack: AverageStackSlice;
  chipsInPlay: ChipsInPlaySlice;
  prizePool: PrizePoolSlice;
  // Só em Bounty Builder.
  bounty: BountySlice | null;
  level: LevelSlice;
}

export function buildMesaPanels(input: MesaPanelsInput): MesaPanelsView {
  return {
    players: derivePlayers(input),
    averageStack: deriveAverageStack(input),
    chipsInPlay: deriveChipsInPlay(input),
    prizePool: derivePrizePool(input),
    bounty: deriveBounty(input),
    level: deriveLevel(input),
  };
}

// Módulo puro dos painéis da Mesa ao vivo (spec #75): recebe o snapshot da mesa,
// o Tempo restante e se quem vê é admin, e devolve o modelo de visão com a face
// de cada card e o conteúdo de cada painel. Os componentes só desenham.
// Cada painel tem a própria derivação, num arquivo deste diretório.

import { deriveAverageStack, type AverageStackSlice } from "./average-stack";
import { deriveBounty, type BountySlice } from "./bounty";
import { deriveChipsInPlay, type ChipsInPlaySlice } from "./chips-in-play";
import { deriveLevel, type LevelSlice } from "./level";
import { derivePlayers, type PlayersSlice } from "./players";
import { derivePrizePool, type PrizePoolSlice } from "./prize-pool";
import type { MesaPanelsInput } from "./types";

export * from "./types";
export type { AverageStackSlice } from "./average-stack";
export type { BountySlice } from "./bounty";
export type { ChipSource, ChipsInPlayLine, ChipsInPlayPanel, ChipsInPlaySlice } from "./chips-in-play";
export type { LevelSlice } from "./level";
export type { PlayersSlice } from "./players";
export type { PrizePoolSlice } from "./prize-pool";

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

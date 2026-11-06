import type { MesaLevel, MesaTournament } from "@/db/queries/mesa";
import type { MesaPanelsInput } from "./types";

type ClockPosition = Pick<MesaTournament, "currentBlindLevel" | "breakActive">;

function sortedLevels(levels: MesaLevel[]): MesaLevel[] {
  return [...levels].sort((a, b) => a.level - b.level);
}

// Nível atual (CONTEXT.md, Relógio): o Nível cujo número é o Nível atual do Relógio.
// Sem nenhum que bata (torneio novo, Relógio no Nível 0), o primeiro da estrutura,
// a mesma regra do Relógio (`ringTotalSecs`, Iniciar). Sem estrutura, `null`.
export function findCurrentLevel(tournament: Pick<ClockPosition, "currentBlindLevel">, levels: MesaLevel[]): MesaLevel | null {
  const sorted = sortedLevels(levels);
  return sorted.find((l) => l.level === tournament.currentBlindLevel) ?? sorted[0] ?? null;
}

// Nível de retorno (CONTEXT.md, Relógio): o Nível cujos blinds valem quando o
// Intervalo termina. Num Intervalo avulso é o Nível interrompido, mesmo que ele
// seja um Intervalo da estrutura: o avulso olha primeiro. Num Intervalo da
// estrutura é o próximo Nível. Fora de Intervalo, ou sem próximo Nível, `null`.
export function findReturnLevel(tournament: ClockPosition, levels: MesaLevel[]): MesaLevel | null {
  const current = findCurrentLevel(tournament, levels);
  if (!current) return null;
  if (tournament.breakActive) return current;
  if (!current.isBreak) return null;
  return sortedLevels(levels).find((l) => l.level > current.level) ?? null;
}

// Próximo Nível de jogo depois de `level`: o primeiro que não é Intervalo da
// estrutura. `null` quando `level` é o último Nível de jogo.
export function findNextPlayLevel(level: Pick<MesaLevel, "level">, levels: MesaLevel[]): MesaLevel | null {
  return sortedLevels(levels).find((l) => l.level > level.level && !l.isBreak) ?? null;
}

// O painel Nível abre pelo bloco do Nível e dos blinds, não por um card.
export interface LevelSlice {
  panel: null;
}

export const deriveLevel: (input: MesaPanelsInput) => LevelSlice = () => ({ panel: null });

import type { MesaLevel, MesaTournament } from "@/db/queries/mesa";
import { findCurrentLevel } from "@/lib/tournament-clock";
import type { MesaPanelsInput } from "./types";

// Nível atual: a regra mora no núcleo do Relógio, que o Iniciar e o anel também usam.
export { findCurrentLevel };

type ClockPosition = Pick<MesaTournament, "currentBlindLevel" | "breakActive">;

function sortedLevels(levels: MesaLevel[]): MesaLevel[] {
  return [...levels].sort((a, b) => a.level - b.level);
}

// Próximo Nível depois de `level`, seja de jogo ou um Intervalo da estrutura.
// `null` quando `level` é o último.
export function findNextLevel(level: Pick<MesaLevel, "level">, levels: MesaLevel[]): MesaLevel | null {
  return sortedLevels(levels).find((l) => l.level > level.level) ?? null;
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
  return findNextLevel(current, levels);
}

// Próximo Nível de jogo depois de `level`: o primeiro que não é Intervalo da
// estrutura. `null` quando `level` é o último Nível de jogo.
export function findNextPlayLevel(level: Pick<MesaLevel, "level">, levels: MesaLevel[]): MesaLevel | null {
  return sortedLevels(levels).find((l) => l.level > level.level && !l.isBreak) ?? null;
}

export interface BlindStructureRow {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  isBigAnte: boolean;
  durationMinutes: number;
  // Intervalo da estrutura.
  isBreak: boolean;
  // Nível do add-on.
  isAddonLevel: boolean;
  isCurrent: boolean;
}

// Painel Nível: a estrutura de blinds inteira, em ordem, com o Nível atual marcado.
export interface BlindStructurePanel {
  levels: BlindStructureRow[];
  // Segundos até o próximo Intervalo da estrutura; `null` quando não há nenhum à frente.
  secondsToNextBreak: number | null;
}

// O painel Nível abre pelo bloco do Nível e dos blinds, não por um card.
export interface LevelSlice {
  panel: BlindStructurePanel;
}

// Tempo restante do Nível atual. Num Intervalo avulso, `remainingSeconds` é o do
// Intervalo, e o do Nível interrompido é o guardado. Com o Relógio nunca iniciado
// (nada gravado), é a duração cheia, como no Iniciar.
function currentLevelRemaining({ snapshot: { tournament }, remainingSeconds }: MesaPanelsInput, current: MesaLevel): number {
  const fullDuration = current.durationMinutes * 60;
  if (tournament.breakActive) return tournament.levelRemainingSecs ?? fullDuration;
  if (!tournament.timerRunning && tournament.timerRemainingSecs === null) return fullDuration;
  return remainingSeconds;
}

// Tempo até o próximo Intervalo da estrutura: o Tempo restante do Nível atual mais
// a duração dos Níveis entre ele e o Intervalo; num Intervalo avulso, mais o que
// resta do Intervalo. Sem Intervalo da estrutura à frente, `null`.
function secondsToNextBreak(input: MesaPanelsInput, current: MesaLevel): number | null {
  const ahead = sortedLevels(input.snapshot.blindLevels).filter((l) => l.level > current.level);
  const breakIndex = ahead.findIndex((l) => l.isBreak);
  if (breakIndex === -1) return null;

  const between = ahead.slice(0, breakIndex).reduce((sum, l) => sum + l.durationMinutes * 60, 0);
  const avulsoRemaining = input.snapshot.tournament.breakActive ? input.remainingSeconds : 0;
  return avulsoRemaining + currentLevelRemaining(input, current) + between;
}

export function deriveLevel(input: MesaPanelsInput): LevelSlice {
  const { tournament, blindLevels } = input.snapshot;
  const current = findCurrentLevel(tournament, blindLevels);
  return {
    panel: {
      levels: sortedLevels(blindLevels).map((l) => ({
        level: l.level,
        smallBlind: l.smallBlind,
        bigBlind: l.bigBlind,
        ante: l.ante,
        isBigAnte: l.isBigAnte,
        durationMinutes: l.durationMinutes,
        isBreak: l.isBreak,
        isAddonLevel: l.isAddonLevel,
        isCurrent: l.level === current?.level,
      })),
      secondsToNextBreak: current ? secondsToNextBreak(input, current) : null,
    },
  };
}

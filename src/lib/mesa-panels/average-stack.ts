import { formatChips } from "@/lib/format";
import type { MesaLevel, MesaSnapshot } from "@/db/queries/mesa";
import { computeChipsInPlay } from "./chips-in-play";
import { findCurrentLevel, findNextPlayLevel, findReturnLevel } from "./level";
import type { CardFace, MesaPanelsInput } from "./types";

// Stack médio (CONTEXT.md) = Fichas em jogo ÷ Participantes em jogo, sem
// arredondar: o arredondamento é só da exibição (`formatAverageStack`).
export interface AverageStackPanel {
  chipsInPlay: number;
  playingCount: number;
  average: number | null;
  // Big blind do Nível de referência; `null` quando não há conversão.
  bigBlind: number | null;
  // Primeiro Nível que não é Intervalo da estrutura depois do Nível de referência; `null` no último.
  nextLevel: { level: number; bigBlind: number | null } | null;
}

export interface AverageStackSlice {
  card: CardFace;
  panel: AverageStackPanel;
}

// Nível que converte o Stack médio em big blinds: durante um Intervalo (da
// estrutura ou avulso), o Nível de retorno; fora dele, o Nível atual. Num
// Intervalo da estrutura sem Nível de retorno, cai no próprio intervalo: sem conversão.
function referenceLevel({ tournament, blindLevels }: Pick<MesaSnapshot, "tournament" | "blindLevels">): MesaLevel | null {
  return findReturnLevel(tournament, blindLevels) ?? findCurrentLevel(tournament, blindLevels);
}

// Big blind que converte fichas em BB; `null` quando o Nível não serve: nenhum,
// é um Intervalo da estrutura ou o big blind não é positivo.
function conversionBigBlind(level: MesaLevel | null): number | null {
  if (!level || level.isBreak || level.bigBlind <= 0) return null;
  return level.bigBlind;
}

export function formatAverageStack(average: number | null): string {
  return average === null ? "—" : formatChips(Math.round(average));
}

export function formatAverageInBigBlinds(average: number | null, bigBlind: number | null): string {
  if (average === null || bigBlind === null) return "—";
  return `≈ ${formatChips(Math.round(average / bigBlind))} BB`;
}

export function deriveAverageStack({ snapshot }: MesaPanelsInput): AverageStackSlice {
  const playingCount = snapshot.participants.filter((p) => p.status === "playing").length;
  const { total } = computeChipsInPlay(snapshot);
  const average = playingCount > 0 ? total / playingCount : null;
  const reference = referenceLevel(snapshot);
  const bigBlind = conversionBigBlind(reference);
  const next = reference && findNextPlayLevel(reference, snapshot.blindLevels);
  return {
    card: {
      label: "Stack medio",
      value: formatAverageStack(average),
      supportLines: [formatAverageInBigBlinds(average, bigBlind)],
    },
    panel: {
      chipsInPlay: total,
      playingCount,
      average,
      bigBlind,
      nextLevel: next ? { level: next.level, bigBlind: conversionBigBlind(next) } : null,
    },
  };
}

import { formatChips } from "@/lib/format";
import type { MesaSnapshot } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";

export type ChipSource = "buyIn" | "rebuy" | "addon" | "bonus";

export interface ChipsInPlayLine {
  source: ChipSource;
  count: number;
  chipsEach: number;
  chips: number;
}

export interface ChipsInPlayPanel {
  // Só as linhas que somam fichas: zeradas ou não permitidas pelo torneio ficam de fora.
  lines: ChipsInPlayLine[];
  total: number;
}

export interface ChipsInPlaySlice {
  card: CardFace;
  panel: ChipsInPlayPanel;
}

// Fichas em jogo (CONTEXT.md): tudo o que entrou por buy-ins confirmados, Rebuys
// (o Rebuy duplo já conta 2 no rebuyCount), add-ons e bônus. Nenhuma ficha sai do jogo.
export function computeChipsInPlay({ tournament, participants }: Pick<MesaSnapshot, "tournament" | "participants">): ChipsInPlayPanel {
  const counts: Record<ChipSource, number> = {
    buyIn: participants.filter((p) => p.buyInPaid).length,
    rebuy: participants.reduce((sum, p) => sum + p.rebuyCount, 0),
    addon: participants.reduce((sum, p) => sum + p.addonCount, 0),
    bonus: participants.filter((p) => p.bonusChipUsed).length,
  };
  const chipsEach: Record<ChipSource, number> = {
    buyIn: tournament.initialChips,
    rebuy: tournament.rebuyChips,
    addon: tournament.addonChips,
    bonus: tournament.bonusChipAmount,
  };
  const lines = (Object.keys(counts) as ChipSource[])
    .map((source) => ({
      source,
      count: counts[source],
      chipsEach: chipsEach[source],
      chips: counts[source] * chipsEach[source],
    }))
    .filter((line) => line.chips > 0);
  return { lines, total: lines.reduce((sum, line) => sum + line.chips, 0) };
}

export function deriveChipsInPlay({ snapshot }: MesaPanelsInput): ChipsInPlaySlice {
  const panel = computeChipsInPlay(snapshot);
  return {
    card: { label: "Fichas em jogo", value: formatChips(panel.total), supportLines: [] },
    panel,
  };
}

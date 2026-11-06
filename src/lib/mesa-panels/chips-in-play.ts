import { formatChips } from "@/lib/format";
import { allowsAddon, allowsBonusChip, allowsRebuy, rebuyLimit } from "@/lib/tournament-entries";
import type { MesaSnapshot, MesaTournament } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";
import { countWithBuyIn } from "./playing";

export type ChipSource = "buyIn" | "rebuy" | "addon" | "bonus";

export interface ChipsInPlayLine {
  source: ChipSource;
  count: number;
  chipsEach: number;
  chips: number;
}

// Entradas que o torneio permite ("ainda dá Rebuy?"): null quando não permite.
export interface ChipsInPlayAllowedEntries {
  // maxPerPlayer null = ilimitado (limite de Rebuys 0).
  rebuy: { amount: number; chips: number; maxPerPlayer: number | null } | null;
  // Add-on não tem limite por pessoa.
  addon: { amount: number; chips: number } | null;
  // Bônus: uma vez por pessoa, sem custo.
  bonus: { chips: number } | null;
}

export interface ChipsInPlayPanel {
  // Só as linhas que somam fichas: zeradas ou não permitidas pelo torneio ficam de fora.
  lines: ChipsInPlayLine[];
  total: number;
  allowedEntries: ChipsInPlayAllowedEntries;
}

export interface ChipsInPlaySlice {
  card: CardFace;
  panel: ChipsInPlayPanel;
}

// Fichas em jogo (CONTEXT.md): tudo o que entrou por buy-ins confirmados, Rebuys
// (o Rebuy duplo já conta 2 no rebuyCount), add-ons e bônus. Nenhuma ficha sai do jogo.
export function computeChipsInPlay({ tournament, participants }: Pick<MesaSnapshot, "tournament" | "participants">): Pick<ChipsInPlayPanel, "lines" | "total"> {
  const counts: Record<ChipSource, number> = {
    buyIn: countWithBuyIn(participants),
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

function allowedEntries(tournament: MesaTournament): ChipsInPlayAllowedEntries {
  return {
    rebuy: allowsRebuy(tournament)
      ? {
          amount: tournament.rebuyAmount,
          chips: tournament.rebuyChips,
          maxPerPlayer: rebuyLimit(tournament),
        }
      : null,
    addon: allowsAddon(tournament) ? { amount: tournament.addonAmount, chips: tournament.addonChips } : null,
    bonus: allowsBonusChip(tournament) ? { chips: tournament.bonusChipAmount } : null,
  };
}

export function deriveChipsInPlay({ snapshot }: MesaPanelsInput): ChipsInPlaySlice {
  const panel = { ...computeChipsInPlay(snapshot), allowedEntries: allowedEntries(snapshot.tournament) };
  return {
    card: { label: "Fichas em jogo", value: formatChips(panel.total), supportLines: [] },
    panel,
  };
}

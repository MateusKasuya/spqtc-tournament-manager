import { formatChips } from "@/lib/format";
import { computeChipsInPlay } from "./chips-in-play";
import type { CardFace, MesaPanelsInput } from "./types";

export interface AverageStackSlice {
  card: CardFace;
  // Painel ainda não construído (spec #75): o card não abre gaveta.
  panel: null;
}

export function deriveAverageStack({ snapshot }: MesaPanelsInput): AverageStackSlice {
  const playingCount = snapshot.participants.filter((p) => p.status === "playing").length;
  const { total } = computeChipsInPlay(snapshot);
  const average = playingCount > 0 ? Math.round(total / playingCount) : 0;
  return {
    card: { label: "Stack medio", value: formatChips(average), sub: null },
    panel: null,
  };
}

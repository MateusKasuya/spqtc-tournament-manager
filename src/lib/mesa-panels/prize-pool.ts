import { formatCurrency } from "@/lib/format";
import { computePrizePool } from "@/lib/prize-pool";
import type { CardFace, MesaPanelsInput } from "./types";

export interface PrizePoolSlice {
  card: CardFace;
  // Painel ainda não construído (spec #75): o card não abre gaveta.
  panel: null;
}

export function derivePrizePool({ snapshot }: MesaPanelsInput): PrizePoolSlice {
  const { prizePool } = computePrizePool({
    rules: snapshot.tournament,
    collected: snapshot.financialSummary,
    participants: snapshot.participants,
  });
  return {
    card: { label: "Prize pool", value: formatCurrency(prizePool), sub: null },
    panel: null,
  };
}

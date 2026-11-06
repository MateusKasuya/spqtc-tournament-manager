import { formatCurrency } from "@/lib/format";
import { computePrizePool } from "@/lib/prize-pool";
import type { CardFace, MesaPanelsInput } from "./types";

export interface PrizePoolSlice {
  card: CardFace;
  panel: null;
}

export function derivePrizePool({ snapshot }: MesaPanelsInput): PrizePoolSlice {
  const { prizePool } = computePrizePool({
    rules: snapshot.tournament,
    collected: snapshot.financialSummary,
    participants: snapshot.participants,
  });
  return {
    card: { label: "Prize pool", value: formatCurrency(prizePool), supportLines: [] },
    panel: null,
  };
}

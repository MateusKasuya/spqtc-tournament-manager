import { formatCurrency } from "@/lib/format";
import { isBountyBuilder } from "@/lib/knockout-ledger";
import type { CardFace, MesaPanelsInput } from "./types";

export interface BountySlice {
  card: CardFace;
  // Painel ainda não construído (spec #75): o card não abre gaveta.
  panel: null;
}

// Só existe em Bounty Builder.
export function deriveBounty({ snapshot }: MesaPanelsInput): BountySlice | null {
  if (!isBountyBuilder(snapshot.tournament)) return null;
  const bountyInPlay = snapshot.participants.reduce((sum, p) => sum + p.currentBounty, 0);
  return {
    card: { label: "Bounty pool", value: formatCurrency(bountyInPlay), sub: "em jogo" },
    panel: null,
  };
}

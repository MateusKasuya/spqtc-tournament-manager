import { displayName } from "@/lib/display-name";
import { formatCurrency } from "@/lib/format";
import { isBountyBuilder, splitBounty } from "@/lib/knockout-ledger";
import { computePrizePool } from "@/lib/prize-pool";
import type { CardFace, MesaPanelsInput } from "./types";

export interface BountyInPlayEntry {
  participantId: number;
  name: string;
  bounty: number;
  // Derrubar sozinho: a divisão do Knockout com um único Eliminador.
  soloKnockout: { cash: number; bounty: number };
}

export interface BountyCollectedEntry {
  participantId: number;
  name: string;
  bountyCollected: number;
  // O do Coroado inclui o próprio Bounty coletado na Coroação; depois de um
  // acordo, ele pode não ser o Campeão.
  crowned: boolean;
}

// Painel Bounty em jogo, em centavos. Listas do maior para o menor; o Bounty
// coletado lista só quem já coletou algum.
export interface BountyPanel {
  inPlay: BountyInPlayEntry[];
  bountyInPlay: number;
  collected: BountyCollectedEntry[];
  collectedTotal: number;
  // O mesmo Bounty armado que o Prize pool desconta. Pela Conservação, é
  // bountyInPlay + collectedTotal: a conferência explica, não diagnostica.
  bountyAllocated: number;
}

export interface BountySlice {
  card: CardFace;
  panel: BountyPanel;
}

// A divisão só depende de quantos Eliminadores há; o id não entra na conta.
const ANY_ELIMINATOR = -1;

function soloKnockout(bounty: number) {
  const [share] = splitBounty(bounty, [ANY_ELIMINATOR]);
  return { cash: share.amount, bounty: share.bountyChange };
}

// Só existe em Bounty Builder.
export function deriveBounty({ snapshot }: MesaPanelsInput): BountySlice | null {
  const { tournament, participants, financialSummary } = snapshot;
  if (!isBountyBuilder(tournament)) return null;

  const inPlay: BountyInPlayEntry[] = participants
    .filter((p) => p.status === "playing")
    .map((p) => ({ participantId: p.id, name: displayName(p), bounty: p.currentBounty, soloKnockout: soloKnockout(p.currentBounty) }))
    .sort((a, b) => b.bounty - a.bounty);
  const collected: BountyCollectedEntry[] = participants
    .filter((p) => p.bountiesCollected > 0)
    .map((p) => ({ participantId: p.id, name: displayName(p), bountyCollected: p.bountiesCollected, crowned: p.status === "finished" }))
    .sort((a, b) => b.bountyCollected - a.bountyCollected);

  const bountyInPlay = inPlay.reduce((sum, e) => sum + e.bounty, 0);
  const panel: BountyPanel = {
    inPlay,
    bountyInPlay,
    collected,
    collectedTotal: collected.reduce((sum, e) => sum + e.bountyCollected, 0),
    bountyAllocated: computePrizePool({ rules: tournament, collected: financialSummary, participants }).bountyAllocated,
  };
  return {
    card: { label: "Bounty em jogo", value: formatCurrency(bountyInPlay), supportLines: [] },
    panel,
  };
}

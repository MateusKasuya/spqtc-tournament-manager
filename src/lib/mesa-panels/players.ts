import type { CardFace, MesaPanelsInput } from "./types";

export interface PlayersSlice {
  card: CardFace;
  panel: null;
}

export function derivePlayers({ snapshot }: MesaPanelsInput): PlayersSlice {
  const playingCount = snapshot.participants.filter((p) => p.status === "playing").length;
  const paidCount = snapshot.participants.filter((p) => p.buyInPaid).length;
  return {
    card: { label: "Jogadores", value: `${playingCount}`, supportLines: [`de ${paidCount} pagos`] },
    panel: null,
  };
}

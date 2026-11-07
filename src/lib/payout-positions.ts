import { renumberedFinalPositions, type LedgerParticipant } from "@/lib/knockout-ledger";

export type PositionedParticipant = Pick<
  LedgerParticipant,
  "id" | "playerId" | "status" | "finishPosition" | "eliminatedAt"
>;

// Posição final de cada Participante depois de uma distribuição de prêmios.
// Quem está na lista fica com a posição do acordo. Quem está fora volta à que a
// mesa dá: sem posição se ainda está em jogo, 1 se é o campeão coroado e, se
// caiu, a da Eliminação pela regra do Ledger de Knockout, pulando as posições do
// acordo para ninguém repetir posição.
export function finalPositionsAfterPayout(
  participants: PositionedParticipant[],
  payouts: { playerId: number; position: number }[]
): Map<number, number | null> {
  const dealPosition = new Map(payouts.map((p) => [p.playerId, p.position]));
  const taken = new Set(dealPosition.values());
  const out = new Map<number, number | null>();

  for (const p of participants) {
    const deal = dealPosition.get(p.playerId);
    if (deal !== undefined) out.set(p.id, deal);
    else if (p.status === "finished") out.set(p.id, 1);
    else if (p.status !== "eliminated") out.set(p.id, null);
  }

  // Um acordo anterior pode ter gravado em quem caiu uma posição fora da ordem
  // das Eliminações; com toda Eliminação carimbada, a ordem sai só do carimbo.
  const fallen = participants.filter((p) => p.status === "eliminated");
  const stamped = fallen.every((p) => p.eliminatedAt !== null);
  const table = renumberedFinalPositions(
    stamped ? participants.map((p) => ({ ...p, finishPosition: null })) : participants
  );

  const playerOf = new Map(participants.map((p) => [p.id, p.playerId]));
  let floor = 0;
  for (const [id, tablePosition] of table) {
    if (dealPosition.has(playerOf.get(id)!)) continue;
    let position = Math.max(tablePosition, floor + 1);
    while (taken.has(position)) position++;
    out.set(id, position);
    floor = position;
  }
  return out;
}

import { isCrowned, renumberedFinalPositions, type LedgerParticipant } from "@/lib/knockout-ledger";

export type PositionedParticipant = Pick<
  LedgerParticipant,
  "id" | "playerId" | "status" | "finishPosition" | "eliminatedAt"
>;

// Posição final por participantId depois de uma distribuição. Quem caiu e está
// fora da lista pula as posições do acordo, para ninguém repetir posição; o
// Coroado fora da lista também, se o acordo deu o 1º a outro.
export function finalPositionsAfterPayout(
  participants: PositionedParticipant[],
  payouts: { playerId: number; position: number }[]
): Map<number, number | null> {
  const dealPositionByPlayer = new Map(payouts.map((p) => [p.playerId, p.position]));
  const dealPositions = new Set(dealPositionByPlayer.values());
  const positionById = new Map<number, number | null>();
  const fallenOutsideDeal = new Set<number>();
  let displacedCrowned: number | null = null;

  for (const p of participants) {
    const dealPosition = dealPositionByPlayer.get(p.playerId);
    if (dealPosition !== undefined) positionById.set(p.id, dealPosition);
    else if (isCrowned(p) && dealPositions.has(1)) displacedCrowned = p.id;
    else if (isCrowned(p)) positionById.set(p.id, 1);
    else if (p.status === "eliminated") fallenOutsideDeal.add(p.id);
    else positionById.set(p.id, null);
  }

  // Um acordo anterior pode ter gravado em quem caiu uma posição fora da ordem
  // das Eliminações; com toda Eliminação carimbada, a ordem sai só do carimbo.
  const allEliminationsStamped = participants.every((p) => p.status !== "eliminated" || p.eliminatedAt !== null);
  const eliminationPositions = renumberedFinalPositions(
    allEliminationsStamped ? participants.map((p) => ({ ...p, finishPosition: null })) : participants
  );

  let lastAssigned = 0;
  const assign = (id: number, tablePosition: number) => {
    let position = Math.max(tablePosition, lastAssigned + 1);
    while (dealPositions.has(position)) position++;
    positionById.set(id, position);
    lastAssigned = position;
  };
  if (displacedCrowned !== null) assign(displacedCrowned, 1);
  for (const [id, eliminationPosition] of eliminationPositions) {
    if (fallenOutsideDeal.has(id)) assign(id, eliminationPosition);
  }
  return positionById;
}

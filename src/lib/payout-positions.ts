import { finalPositions, type DealPositionedParticipant, type LedgerParticipant } from "@/lib/knockout-ledger";

export type PositionedParticipant = Omit<DealPositionedParticipant, "dealPosition"> & Pick<LedgerParticipant, "playerId">;

// Acordo novo de uma distribuição: a posição do Acordo por participantId (nula
// para quem fica fora, inclusive quem estava no Acordo anterior) e a Posição
// final que a regra única dá a cada um com esse Acordo.
export function positionsAfterPayout(
  participants: PositionedParticipant[],
  payouts: { playerId: number; position: number }[]
): Map<number, { dealPosition: number | null; finishPosition: number | null }> {
  const dealPositionByPlayer = new Map(payouts.map((p) => [p.playerId, p.position]));
  const withDeal = participants.map((p) => ({ ...p, dealPosition: dealPositionByPlayer.get(p.playerId) ?? null }));
  const finishById = finalPositions(withDeal);
  return new Map(
    withDeal.map((p) => [p.id, { dealPosition: p.dealPosition, finishPosition: finishById.get(p.id) ?? null }])
  );
}

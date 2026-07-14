const POINTS_TABLE: Record<number, number> = {
  1: 12,
  2: 10,
  3: 8,
  4: 6,
  5: 4,
  6: 2,
};

const DEFAULT_POINTS = 1;

export function getPointsForPosition(position: number): number {
  return POINTS_TABLE[position] ?? DEFAULT_POINTS;
}

// Bônus de ranking por eliminação em torneios bounty: cada knockout coletado
// (uma transação bounty_earned) rende este valor ao eliminador.
export const ELIMINATION_BONUS_POINTS = 0.25;

export function computeParticipantPoints(position: number, knockouts: number): number {
  return getPointsForPosition(position) + knockouts * ELIMINATION_BONUS_POINTS;
}

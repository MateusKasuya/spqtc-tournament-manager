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

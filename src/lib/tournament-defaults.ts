export const DEFAULT_PRIZE_STRUCTURES: Record<string, { position: number; percentage: number }[]> = {
  "3-4": [{ position: 1, percentage: 100 }],
  "5-6": [
    { position: 1, percentage: 70 },
    { position: 2, percentage: 30 },
  ],
  "7-10": [
    { position: 1, percentage: 50 },
    { position: 2, percentage: 30 },
    { position: 3, percentage: 20 },
  ],
  "11-15": [
    { position: 1, percentage: 45 },
    { position: 2, percentage: 27 },
    { position: 3, percentage: 18 },
    { position: 4, percentage: 10 },
  ],
  "16-20": [
    { position: 1, percentage: 40 },
    { position: 2, percentage: 25 },
    { position: 3, percentage: 18 },
    { position: 4, percentage: 12 },
    { position: 5, percentage: 5 },
  ],
};

export function getDefaultPrizeStructure(playerCount: number) {
  if (playerCount <= 4) return DEFAULT_PRIZE_STRUCTURES["3-4"];
  if (playerCount <= 6) return DEFAULT_PRIZE_STRUCTURES["5-6"];
  if (playerCount <= 10) return DEFAULT_PRIZE_STRUCTURES["7-10"];
  if (playerCount <= 15) return DEFAULT_PRIZE_STRUCTURES["11-15"];
  return DEFAULT_PRIZE_STRUCTURES["16-20"];
}

export const DEFAULT_BLIND_STRUCTURE = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 5, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true, isAddonLevel: true, isBigAnte: false },
  { level: 6, smallBlind: 150, bigBlind: 300, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 7, smallBlind: 200, bigBlind: 400, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 8, smallBlind: 300, bigBlind: 600, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 9, smallBlind: 400, bigBlind: 800, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 10, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true, isAddonLevel: false, isBigAnte: false },
  { level: 11, smallBlind: 500, bigBlind: 1000, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 12, smallBlind: 600, bigBlind: 1200, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 13, smallBlind: 800, bigBlind: 1600, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 14, smallBlind: 1000, bigBlind: 2000, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
  { level: 15, smallBlind: 1500, bigBlind: 3000, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: true },
];

export const DEFAULT_PRIZE_STRUCTURE = [
  { position: 1, percentage: 45 },
  { position: 2, percentage: 25 },
  { position: 3, percentage: 15 },
  { position: 4, percentage: 10 },
  { position: 5, percentage: 5 },
];

export function getDefaultPrizeStructure(_playerCount: number) {
  return DEFAULT_PRIZE_STRUCTURE;
}

export const DEFAULT_BLIND_STRUCTURE = [
  { level: 1,  smallBlind: 10,   bigBlind: 20,    ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 2,  smallBlind: 20,   bigBlind: 40,    ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 3,  smallBlind: 30,   bigBlind: 60,    ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 4,  smallBlind: 40,   bigBlind: 80,    ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 5,  smallBlind: 50,   bigBlind: 100,   ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 6,  smallBlind: 60,   bigBlind: 120,   ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 7,  smallBlind: 80,   bigBlind: 160,   ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 8,  smallBlind: 100,  bigBlind: 200,   ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 9,  smallBlind: 125,  bigBlind: 250,   ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 10, smallBlind: 150,  bigBlind: 300,   ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
  { level: 11, smallBlind: 175,  bigBlind: 350,   ante: 0, durationMinutes: 13, isBreak: false, isAddonLevel: true,  isBigAnte: true  },
  { level: 12, smallBlind: 200,  bigBlind: 400,   ante: 0, durationMinutes: 13, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 13, smallBlind: 225,  bigBlind: 450,   ante: 0, durationMinutes: 13, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 14, smallBlind: 250,  bigBlind: 500,   ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 15, smallBlind: 300,  bigBlind: 600,   ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 16, smallBlind: 350,  bigBlind: 700,   ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 17, smallBlind: 400,  bigBlind: 800,   ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 18, smallBlind: 500,  bigBlind: 1000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 19, smallBlind: 600,  bigBlind: 1200,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 20, smallBlind: 700,  bigBlind: 1400,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 21, smallBlind: 850,  bigBlind: 1700,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 22, smallBlind: 1000, bigBlind: 2000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 23, smallBlind: 1200, bigBlind: 2400,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 24, smallBlind: 1500, bigBlind: 3000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 25, smallBlind: 1750, bigBlind: 3500,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 26, smallBlind: 2000, bigBlind: 4000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 27, smallBlind: 2500, bigBlind: 5000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 28, smallBlind: 3000, bigBlind: 6000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 29, smallBlind: 4000, bigBlind: 8000,  ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
  { level: 30, smallBlind: 5000, bigBlind: 10000, ante: 0, durationMinutes: 10, isBreak: false, isAddonLevel: false, isBigAnte: true  },
];

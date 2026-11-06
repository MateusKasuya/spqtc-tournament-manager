// Snapshot da mesa para os testes dos painéis (um arquivo de teste por painel).
// Sem `.test` no nome: o vitest não o roda sozinho.

import type { MesaPanelsInput } from "@/lib/mesa-panels";
import type { MesaLevel, MesaParticipant, MesaSnapshot, MesaTournament } from "@/db/queries/mesa";

export function makeTournament(overrides: Partial<MesaTournament> = {}): MesaTournament {
  return {
    id: 1,
    name: "Torneio de teste",
    status: "running",
    tournamentType: "normal",
    buyInAmount: 10000,
    rebuyAmount: 10000,
    addonAmount: 10000,
    initialChips: 10000,
    rebuyChips: 10000,
    addonChips: 15000,
    bonusChipAmount: 2000,
    allowAddon: true,
    rankingFeeAmount: 2000,
    maxRebuys: 0,
    currentBlindLevel: 1,
    timerRunning: false,
    timerRemainingSecs: null,
    timerStartedAt: null,
    breakActive: false,
    levelRemainingSecs: null,
    breakTotalSecs: null,
    ...overrides,
  };
}

let nextParticipantId = 1;

export function makeParticipant(overrides: Partial<MesaParticipant> = {}): MesaParticipant {
  const id = nextParticipantId++;
  return {
    id,
    playerId: 100 + id,
    name: `Jogador ${id}`,
    nickname: null,
    status: "playing",
    finishPosition: null,
    buyInPaid: true,
    rebuyCount: 0,
    addonCount: 0,
    bonusChipUsed: false,
    currentBounty: 0,
    bountiesCollected: 0,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<MesaSnapshot> = {}): MesaSnapshot {
  return {
    tournament: makeTournament(),
    blindLevels: [],
    participants: [],
    financialSummary: { buy_in: 0, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 },
    prizeStructure: [],
    paidPrizesByParticipant: [],
    ...overrides,
  };
}

export function makeInput(overrides: Partial<MesaPanelsInput> = {}): MesaPanelsInput {
  return { snapshot: makeSnapshot(), remainingSeconds: 0, isAdmin: false, ...overrides };
}

// Nível da estrutura de blinds: só o número é obrigatório; os blinds saem dele
// (Nível 3 → 300/600) para os testes conferirem de onde veio cada big blind.
export function makeLevel(level: number, overrides: Partial<MesaLevel> = {}): MesaLevel {
  return {
    level,
    smallBlind: level * 100,
    bigBlind: level * 200,
    ante: 0,
    durationMinutes: 20,
    isBreak: false,
    isAddonLevel: false,
    isBigAnte: false,
    ...overrides,
  };
}

// Distribuir prêmios no snapshot: os Prêmios pagos por Participante e o total
// deles no resumo financeiro, que vêm dos mesmos registros de Prêmio.
export function payPrizes(snapshot: MesaSnapshot, paid: [MesaParticipant, number][]): MesaSnapshot {
  return {
    ...snapshot,
    paidPrizesByParticipant: paid.map(([p, amount]) => ({ participantId: p.id, amount })),
    financialSummary: {
      ...snapshot.financialSummary,
      prize: paid.reduce((total, [, amount]) => total + amount, 0),
    },
  };
}

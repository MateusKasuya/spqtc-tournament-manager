import { describe, it, expect } from "vitest";
import { computePrizePool, type PrizePoolParticipant } from "@/lib/prize-pool";
import {
  planKnockout,
  planUndo,
  initialBounty,
  rebuyBounty,
  type LedgerSnapshot,
  type LedgerParticipant,
  type LedgerRow,
  type LedgerRules,
  type KnockoutPlan,
} from "@/lib/knockout-ledger";

const RULES: LedgerRules = {
  tournamentType: "bounty_builder",
  buyInAmount: 10000,
  rankingFeeAmount: 2000,
  rebuyAmount: 6000,
  maxRebuys: 0,
  bountyPercentage: 50,
};

function paid(n: number, bounty = 0): PrizePoolParticipant[] {
  return Array.from({ length: n }, () => ({ buyInPaid: true, currentBounty: bounty, bountiesCollected: 0 }));
}

// Participante i tem id i+1 e playerId 100+i, todos com buy-in confirmado.
function makeSnapshot(n: number): LedgerSnapshot {
  const participants: LedgerParticipant[] = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    playerId: 100 + i,
    status: "playing",
    buyInPaid: true,
    finishPosition: null,
    rebuyCount: 0,
    currentBounty: initialBounty(RULES),
    bountiesCollected: 0,
    eliminatedByIds: [],
  }));
  return { rules: RULES, participants, rows: [], now: new Date("2026-09-24T12:00:00.000Z") };
}

// Simula o adapter do ledger: aplica o plano sobre o snapshot.
function applyPlan(snapshot: LedgerSnapshot, plan: KnockoutPlan, createdAt: string): LedgerSnapshot {
  let nextId = snapshot.rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const rows: LedgerRow[] = snapshot.rows
    .filter((r) => !plan.deleteIds.includes(r.id))
    .concat(plan.inserts.map((r) => ({ ...r, id: nextId++, createdAt })));
  const participants = snapshot.participants.map((p) => {
    const patch = plan.patches.find((x) => x.participantId === p.id);
    if (!patch) return p;
    const { eliminatedAt: _ignored, ...set } = patch.set;
    return { ...p, ...set };
  });
  return { ...snapshot, participants, rows };
}

// Prize pool calculado a partir do snapshot do ledger, como fariam as telas:
// buy-ins pagos + linhas de rebuy do ledger como Arrecadado.
function prizePoolOf(s: LedgerSnapshot) {
  const paidCount = s.participants.filter((p) => p.buyInPaid).length;
  const rebuy = s.rows.filter((r) => r.type === "rebuy").reduce((sum, r) => sum + r.amount, 0);
  return computePrizePool({
    rules: s.rules,
    collected: { buy_in: paidCount * s.rules.buyInAmount, rebuy, addon: 0 },
    participants: s.participants,
  });
}

describe("Prize pool", () => {
  it("torneio normal sem Bounty: Arrecadado menos Fundo de ranking, nada de Bounty armado", () => {
    const result = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 2000 },
      collected: { buy_in: 40000, rebuy: 0, addon: 0 },
      participants: paid(4),
    });
    expect(result).toEqual({ collected: 40000, rankingFund: 8000, bountyAllocated: 0, prizePool: 32000 });
  });

  it("torneio normal ignora Bounty que por acaso esteja nas colunas dos participantes", () => {
    const result = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 0 },
      collected: { buy_in: 20000, rebuy: 0, addon: 0 },
      participants: [
        { buyInPaid: true, currentBounty: 500, bountiesCollected: 300 },
        { buyInPaid: true, currentBounty: 0, bountiesCollected: 0 },
      ],
    });
    expect(result).toEqual({ collected: 20000, rankingFund: 0, bountyAllocated: 0, prizePool: 20000 });
  });

  it("Bounty Builder desconta o Bounty armado (em jogo + coletado)", () => {
    const result = computePrizePool({
      rules: { tournamentType: "bounty_builder", rankingFeeAmount: 2000 },
      collected: { buy_in: 30000, rebuy: 0, addon: 0 },
      participants: [
        { buyInPaid: true, currentBounty: 6000, bountiesCollected: 2000 },
        { buyInPaid: true, currentBounty: 4000, bountiesCollected: 0 },
        { buyInPaid: true, currentBounty: 0, bountiesCollected: 0 },
      ],
    });
    expect(result).toEqual({ collected: 30000, rankingFund: 6000, bountyAllocated: 12000, prizePool: 12000 });
  });

  it("Rebuy e add-on entram no Arrecadado mas não no Fundo de ranking", () => {
    const base = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 2000 },
      collected: { buy_in: 30000, rebuy: 0, addon: 0 },
      participants: paid(3),
    });
    const withRebuyAndAddon = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 2000 },
      collected: { buy_in: 30000, rebuy: 12000, addon: 5000 },
      participants: paid(3),
    });
    expect(withRebuyAndAddon.rankingFund).toBe(base.rankingFund);
    expect(withRebuyAndAddon.collected).toBe(47000);
    expect(withRebuyAndAddon.prizePool).toBe(base.prizePool + 17000);
  });

  it("participante sem buy-in confirmado fica fora do Fundo de ranking", () => {
    const result = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 2000 },
      collected: { buy_in: 20000, rebuy: 0, addon: 0 },
      participants: [...paid(2), { buyInPaid: false, currentBounty: 0, bountiesCollected: 0 }],
    });
    expect(result).toEqual({ collected: 20000, rankingFund: 4000, bountyAllocated: 0, prizePool: 16000 });
  });

  it("Prize pool igual antes e depois de um Knockout e do seu Desfazer", () => {
    const s0 = makeSnapshot(4);
    const s1 = applyPlan(s0, planKnockout(s0, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101, 102] }), "2026-09-24 12:00:01+00");
    const s2 = applyPlan(s1, planKnockout(s1, { kind: "elimination", victimId: 2, eliminatorPlayerIds: [103] }), "2026-09-24 12:00:02+00");
    const s3 = applyPlan(s2, planUndo(s2, { kind: "elimination", victimId: 2 }), "2026-09-24 12:00:03+00");

    const before = prizePoolOf(s0);
    expect(before.bountyAllocated).toBe(4 * initialBounty(RULES));
    for (const s of [s1, s2, s3]) {
      expect(prizePoolOf(s)).toEqual(before);
    }
  });

  it("Rebuy em Bounty Builder aumenta o Prize pool pelo valor do Rebuy menos o Bounty novo", () => {
    const s0 = makeSnapshot(3);
    const s1 = applyPlan(s0, planKnockout(s0, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 }), "2026-09-24 12:00:01+00");
    expect(prizePoolOf(s1).prizePool).toBe(prizePoolOf(s0).prizePool + RULES.rebuyAmount - rebuyBounty(RULES));
  });

  it("buy-in zero: Fundo de ranking continua sendo a taxa vezes os buy-ins confirmados", () => {
    const result = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 0 },
      collected: { buy_in: 0, rebuy: 0, addon: 0 },
      participants: paid(5),
    });
    expect(result).toEqual({ collected: 0, rankingFund: 0, bountyAllocated: 0, prizePool: 0 });

    const withFee = computePrizePool({
      rules: { tournamentType: "normal", rankingFeeAmount: 1000 },
      collected: { buy_in: 0, rebuy: 3000, addon: 0 },
      participants: paid(2),
    });
    expect(withFee).toEqual({ collected: 3000, rankingFund: 2000, bountyAllocated: 0, prizePool: 1000 });
  });
});

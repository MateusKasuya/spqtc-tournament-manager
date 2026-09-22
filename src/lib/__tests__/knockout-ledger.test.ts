import { describe, it, expect } from "vitest";
import {
  planKnockout,
  checkKnockout,
  type LedgerSnapshot,
  type LedgerParticipant,
  type LedgerRow,
  type KnockoutPlan,
  type LedgerRules,
} from "@/lib/knockout-ledger";

const RULES: LedgerRules = {
  tournamentType: "bounty_builder",
  buyInAmount: 100,
  rankingFeeAmount: 20,
  rebuyAmount: 60,
  maxRebuys: 0,
  bountyPercentage: 50,
};

const NOW = new Date("2026-09-22T12:00:00.000Z");

// Participante i tem id i+1 e playerId 100+i.
function makeSnapshot(bounties: number[], overrides: Partial<LedgerRules> = {}): LedgerSnapshot {
  const participants: LedgerParticipant[] = bounties.map((b, i) => ({
    id: i + 1,
    playerId: 100 + i,
    status: "playing",
    buyInPaid: true,
    finishPosition: null,
    rebuyCount: 0,
    currentBounty: b,
    bountiesCollected: 0,
    eliminatedByIds: [],
  }));
  return { rules: { ...RULES, ...overrides }, participants, rows: [], now: NOW };
}

// Simula o adapter: aplica o plano sobre o snapshot e devolve o snapshot resultante.
function applyPlan(snapshot: LedgerSnapshot, plan: KnockoutPlan, createdAt = "2026-09-22 12:00:00+00"): LedgerSnapshot {
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

function totalBounty(s: LedgerSnapshot) {
  return s.participants.reduce((sum, p) => sum + p.currentBounty + p.bountiesCollected, 0);
}

describe("Ledger de Knockout: eliminação", () => {
  it("Conservação: soma dos Bounties em jogo + coletados é invariante (bounty × N Eliminadores × modo)", () => {
    for (const mode of ["bounty_builder", "normal"] as const) {
      for (const b of [0, 1, 7, 100, 101, 333]) {
        for (const n of [1, 2, 3, 5]) {
          const s = makeSnapshot([b, 40, 40, 40, 40, 40], { tournamentType: mode });
          const eliminators = Array.from({ length: n }, (_, i) => 101 + i);
          const after = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: eliminators }));
          expect(totalBounty(after)).toBe(totalBounty(s));
        }
      }
    }
  });

  it("redistribui metade em dinheiro e metade em Bounty para os Eliminadores; Vítima fica com zero e posição final", () => {
    const s = makeSnapshot([40, 40, 40, 40]);
    const after = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101, 102] }));
    const [v, e1, e2, other] = after.participants;
    expect(v).toMatchObject({ status: "eliminated", finishPosition: 4, currentBounty: 0, eliminatedByIds: [101, 102] });
    expect(e1).toMatchObject({ currentBounty: 50, bountiesCollected: 10 });
    expect(e2).toMatchObject({ currentBounty: 50, bountiesCollected: 10 });
    expect(other).toMatchObject({ currentBounty: 40, bountiesCollected: 0, status: "playing" });
    expect(after.rows.map((r) => [r.playerId, r.amount, r.bountyChange, r.relatedParticipantId])).toEqual([
      [101, 10, 10, 1],
      [102, 10, 10, 1],
    ]);
  });

  it("Coroação: com dois em jogo, o outro vira campeão e coleta o próprio Bounty; fold quando também é Eliminador", () => {
    const s = makeSnapshot([40, 40]);
    const plan = planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101] });
    expect(plan.crowned).toBe(true);
    // um único patch para o campeão-Eliminador
    expect(plan.patches.filter((p) => p.participantId === 2)).toHaveLength(1);
    const after = applyPlan(s, plan);
    expect(after.participants[1]).toMatchObject({ status: "finished", finishPosition: 1, currentBounty: 0, bountiesCollected: 80 });
    expect(after.participants[0]).toMatchObject({ status: "eliminated", finishPosition: 2 });
    // autocoleta: Eliminador igual à Vítima, valor igual ao Bounty (40 + 20 acumulado), acúmulo zero
    expect(after.rows).toContainEqual(expect.objectContaining({ playerId: 101, relatedParticipantId: 2, amount: 60, bountyChange: 0 }));
    expect(totalBounty(after)).toBe(80);
  });

  it("sempre grava: Knockout de Vítima com Bounty zero e Coroação com Bounty zero geram linhas de valor zero", () => {
    const s = makeSnapshot([0, 0]);
    const plan = planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101] });
    expect(plan.inserts).toEqual([
      { playerId: 101, type: "bounty_earned", amount: 0, bountyChange: 0, relatedParticipantId: 1 },
      { playerId: 101, type: "bounty_earned", amount: 0, bountyChange: 0, relatedParticipantId: 2 },
    ]);
  });

  it("torneio normal: mesmo caminho sem linhas de bounty; status, posição e Coroação iguais", () => {
    const s = makeSnapshot([0, 0, 0], { tournamentType: "normal" });
    const plan1 = planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [] });
    expect(plan1.inserts).toEqual([]);
    expect(plan1.crowned).toBe(false);
    const s2 = applyPlan(s, plan1);
    const plan2 = planKnockout(s2, { kind: "elimination", victimId: 2, eliminatorPlayerIds: [] });
    expect(plan2.inserts).toEqual([]);
    expect(plan2.crowned).toBe(true);
    const s3 = applyPlan(s2, plan2);
    expect(s3.participants.map((p) => [p.status, p.finishPosition])).toEqual([
      ["eliminated", 3],
      ["eliminated", 2],
      ["finished", 1],
    ]);
  });

  it("precondições em pt-BR: Eliminador vazio em Bounty Builder, fora de jogo, a si mesmo, Vítima fora de jogo", () => {
    const s = makeSnapshot([40, 40, 40]);
    expect(checkKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [] })).toEqual({ error: "Selecione quem eliminou o jogador" });
    expect(checkKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [100] })).toEqual({ error: "Jogador nao pode eliminar a si mesmo" });
    expect(checkKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [999] })).toEqual({ error: "Eliminador nao esta em jogo" });
    s.participants[2].status = "eliminated";
    expect(checkKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [102] })).toEqual({ error: "Eliminador nao esta em jogo" });
    expect(checkKnockout(s, { kind: "elimination", victimId: 3, eliminatorPlayerIds: [101] })).toEqual({ error: "Jogador nao esta em jogo" });
    expect(checkKnockout(s, { kind: "elimination", victimId: 42, eliminatorPlayerIds: [101] })).toEqual({ error: "Participante nao encontrado" });
    expect(checkKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101] })).toBeNull();
    // torneio normal não exige Eliminador
    const n = makeSnapshot([0, 0], { tournamentType: "normal" });
    expect(checkKnockout(n, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [] })).toBeNull();
  });
});

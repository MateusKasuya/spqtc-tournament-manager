import { describe, it, expect } from "vitest";
import {
  planKnockout,
  planUndo,
  checkKnockout,
  checkUndo,
  splitBounty,
  initialBounty,
  rebuyBounty,
  LedgerUndoBlockedError,
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

describe("Ledger de Knockout: Desfazer eliminação", () => {
  it("round-trip: aplicar e desfazer devolve o snapshot original (bounty × N Eliminadores × modo)", () => {
    for (const mode of ["bounty_builder", "normal"] as const) {
      for (const b of [0, 7, 100]) {
        for (const n of [1, 2, 3]) {
          const s = makeSnapshot([b, 40, 40, 40], { tournamentType: mode });
          const eliminators = Array.from({ length: n }, (_, i) => 101 + i);
          const applied = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: eliminators }));
          const undone = applyPlan(applied, planUndo(applied, { kind: "elimination", victimId: 1 }));
          expect(undone.participants).toEqual(s.participants);
          expect(undone.rows).toEqual([]);
        }
      }
    }
  });

  it("round-trip da eliminação final: descoroa e só depois reverte a Vítima (campeão também Eliminador)", () => {
    const s = makeSnapshot([40, 40]);
    const applied = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101] }));
    const plan = planUndo(applied, { kind: "elimination", victimId: 1 });
    expect(plan.uncrowned).toBe(true);
    expect(plan.patches.filter((p) => p.participantId === 2)).toHaveLength(1);
    const undone = applyPlan(applied, plan);
    expect(undone.participants).toEqual(s.participants);
    expect(undone.rows).toEqual([]);
  });

  it("Desfazer no campeão só descoroa: devolve o Bounty da Coroação e não toca na última Vítima", () => {
    const s = makeSnapshot([40, 40]);
    const applied = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101] }));
    const plan = planUndo(applied, { kind: "elimination", victimId: 2 });
    expect(plan.uncrowned).toBe(true);
    const undone = applyPlan(applied, plan);
    expect(undone.participants[1]).toMatchObject({ status: "playing", finishPosition: null, currentBounty: 60, bountiesCollected: 20 });
    expect(undone.participants[0]).toMatchObject({ status: "eliminated", finishPosition: 2, currentBounty: 0 });
    expect(undone.rows).toHaveLength(1);
    expect(undone.rows[0]).toMatchObject({ playerId: 101, relatedParticipantId: 1, amount: 20, bountyChange: 20 });
  });

  it("Coroação com Bounty zero desfeita apaga a linha de valor zero e não altera prêmio antigo do campeão", () => {
    const s = makeSnapshot([40, 0, 0]);
    // P2 elimina P0 (P2 coleta 20, Bounty 20); P1 elimina P2 → P1 campeão com Bounty 0... mas P1 recebe 10/10
    const s1 = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [102] }), "2026-09-22 12:00:01+00");
    const s2 = applyPlan(s1, planKnockout(s1, { kind: "elimination", victimId: 3, eliminatorPlayerIds: [101] }), "2026-09-22 12:00:02+00");
    const undone = applyPlan(s2, planUndo(s2, { kind: "elimination", victimId: 3 }), "2026-09-22 12:00:03+00");
    expect(undone.participants).toEqual(s1.participants);
    expect(undone.rows).toEqual(s1.rows);
  });

  it("agrupa pelo texto exato de createdAt: microssegundos distintos separam o rebuy da eliminação", () => {
    const s = makeSnapshot([30, 60, 55]);
    s.participants[0].rebuyCount = 1;
    s.participants[0].eliminatedByIds = [102];
    s.participants[0].status = "eliminated";
    s.participants[0].finishPosition = 3;
    s.participants[0].currentBounty = 0;
    s.participants[1].bountiesCollected = 20;
    s.participants[2].bountiesCollected = 15;
    s.rows = [
      { id: 1, playerId: 101, type: "bounty_earned", amount: 20, bountyChange: 20, relatedParticipantId: 1, createdAt: "2026-01-01 00:00:00.123457+00" },
      { id: 2, playerId: 100, type: "rebuy", amount: 60, bountyChange: 0, relatedParticipantId: null, createdAt: "2026-01-01 00:00:00.123457+00" },
      { id: 3, playerId: 102, type: "bounty_earned", amount: 15, bountyChange: 15, relatedParticipantId: 1, createdAt: "2026-01-01 00:00:00.123458+00" },
    ];
    const plan = planUndo(s, { kind: "elimination", victimId: 1 });
    expect(plan.deleteIds).toEqual([3]);
    const undone = applyPlan(s, plan);
    expect(undone.participants[0]).toMatchObject({ status: "playing", currentBounty: 30, rebuyCount: 1, eliminatedByIds: [101] });
    expect(undone.participants[1]).toMatchObject({ currentBounty: 60, bountiesCollected: 20 });
    expect(undone.participants[2]).toMatchObject({ currentBounty: 40, bountiesCollected: 0 });
  });

  it("Vítima recebe de volta o que tinha antes mais o que acumulou depois como Eliminadora", () => {
    const s = makeSnapshot([40, 40, 40]);
    const s1 = applyPlan(s, planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 }), "2026-09-22 12:00:01+00");
    // P0 (Bounty novo 30) elimina P1 e acumula 30 → 60
    const s2 = applyPlan(s1, planKnockout(s1, { kind: "elimination", victimId: 2, eliminatorPlayerIds: [100] }), "2026-09-22 12:00:02+00");
    expect(s2.participants[0].currentBounty).toBe(60);
    const s3 = applyPlan(s2, planKnockout(s2, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [102] }), "2026-09-22 12:00:03+00");
    const undone = applyPlan(s3, planUndo(s3, { kind: "elimination", victimId: 1 }));
    expect(undone.participants).toEqual(s2.participants);
  });

  it("recusa Desfazer quando um Eliminador já foi Vítima de Knockout posterior; aceita após desfazer o posterior", () => {
    const s = makeSnapshot([40, 40, 40, 40]);
    const s1 = applyPlan(s, planKnockout(s, { kind: "elimination", victimId: 1, eliminatorPlayerIds: [101] }), "2026-09-22 12:00:01+00");
    const s2 = applyPlan(s1, planKnockout(s1, { kind: "elimination", victimId: 2, eliminatorPlayerIds: [102] }), "2026-09-22 12:00:02+00");
    expect(() => planUndo(s2, { kind: "elimination", victimId: 1 })).toThrow(LedgerUndoBlockedError);
    const s3 = applyPlan(s2, planUndo(s2, { kind: "elimination", victimId: 2 }));
    expect(s3.participants).toEqual(s1.participants);
    const s4 = applyPlan(s3, planUndo(s3, { kind: "elimination", victimId: 1 }));
    expect(s4.participants).toEqual(s.participants);
  });

  it("precondições do Desfazer em pt-BR", () => {
    const s = makeSnapshot([40, 40, 40]);
    expect(checkUndo(s, { kind: "elimination", victimId: 1 })).toEqual({ error: "Jogador nao esta eliminado" });
    expect(checkUndo(s, { kind: "elimination", victimId: 99 })).toEqual({ error: "Participante nao encontrado" });
    s.participants[0].status = "eliminated";
    expect(checkUndo(s, { kind: "elimination", victimId: 1 })).toBeNull();
    s.participants[0].status = "finished";
    expect(checkUndo(s, { kind: "elimination", victimId: 1 })).toBeNull();
  });
});

describe("Ledger de Knockout: rebuy", () => {
  it("Conservação para rebuy simples e duplo: o total cresce exatamente pelo Bounty novo armado", () => {
    for (const count of [1, 2] as const) {
      for (const b of [0, 7, 100]) {
        for (const n of [1, 2, 3]) {
          const s = makeSnapshot([b, 40, 40, 40]);
          const eliminators = Array.from({ length: n }, (_, i) => 101 + i);
          const after = applyPlan(s, planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: eliminators, count }));
          expect(totalBounty(after)).toBe(totalBounty(s) + 30); // rebuy 60 × 50% = 30
          expect(after.participants[0]).toMatchObject({ rebuyCount: count, currentBounty: 30, status: "playing", eliminatedByIds: eliminators });
        }
      }
    }
  });

  it("rebuy duplo: duas linhas de rebuy e as linhas de bounty compartilham o mesmo evento", () => {
    const s = makeSnapshot([40, 40, 40]);
    const plan = planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 2 });
    expect(plan.inserts).toEqual([
      { playerId: 101, type: "bounty_earned", amount: 20, bountyChange: 20, relatedParticipantId: 1 },
      { playerId: 100, type: "rebuy", amount: 60, bountyChange: 0, relatedParticipantId: null },
      { playerId: 100, type: "rebuy", amount: 60, bountyChange: 0, relatedParticipantId: null },
    ]);
    expect(plan.crowned).toBe(false);
  });

  it("torneio normal: rebuy incrementa o contador e grava só a linha de rebuy", () => {
    const s = makeSnapshot([0, 0, 0], { tournamentType: "normal" });
    const plan = planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [], count: 1 });
    expect(plan.inserts).toEqual([{ playerId: 100, type: "rebuy", amount: 60, bountyChange: 0, relatedParticipantId: null }]);
    expect(plan.patches).toEqual([{ participantId: 1, set: { rebuyCount: 1 } }]);
  });

  it("precondições do rebuy: buy-in, torneio sem rebuy, limite, fora de jogo, Eliminadores", () => {
    const s = makeSnapshot([40, 40, 40]);
    s.participants[0].buyInPaid = false;
    expect(checkKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 })).toEqual({ error: "Jogador ainda nao pagou buy-in" });
    s.participants[0].buyInPaid = true;
    expect(checkKnockout({ ...s, rules: { ...s.rules, rebuyAmount: 0 } }, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 })).toEqual({ error: "Torneio nao permite rebuy" });
    expect(checkKnockout({ ...s, rules: { ...s.rules, maxRebuys: 1 } }, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 2 })).toEqual({ error: "Limite de rebuys atingido (max: 1)" });
    expect(checkKnockout({ ...s, rules: { ...s.rules, maxRebuys: 2 } }, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 2 })).toBeNull();
    expect(checkKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [], count: 1 })).toEqual({ error: "Selecione quem eliminou o jogador" });
    expect(checkKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [100], count: 1 })).toEqual({ error: "Jogador nao pode eliminar a si mesmo" });
    s.participants[1].status = "eliminated";
    expect(checkKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 })).toEqual({ error: "Eliminador nao esta em jogo" });
    expect(checkKnockout(s, { kind: "rebuy", victimId: 2, eliminatorPlayerIds: [102], count: 1 })).toEqual({ error: "Jogador nao esta em jogo" });
  });
});

describe("Ledger de Knockout: Desfazer rebuy", () => {
  it("round-trip rebuy → Desfazer devolve o snapshot original (simples e duplo, N Eliminadores)", () => {
    for (const count of [1, 2] as const) {
      for (const b of [0, 7, 100]) {
        for (const n of [1, 2, 3]) {
          const s = makeSnapshot([b, 40, 40, 40]);
          const eliminators = Array.from({ length: n }, (_, i) => 101 + i);
          let cur = applyPlan(s, planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: eliminators, count }));
          for (let i = 0; i < count; i++) cur = applyPlan(cur, planUndo(cur, { kind: "rebuy", victimId: 1 }));
          expect(cur.participants).toEqual(s.participants);
          expect(cur.rows).toEqual([]);
        }
      }
    }
  });

  it("rebuy duplo desfeito em dois toques: o primeiro tira uma recompra sem tocar no Bounty, o segundo reverte o Knockout", () => {
    const s = makeSnapshot([40, 40, 40]);
    const s1 = applyPlan(s, planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 2 }));
    const first = planUndo(s1, { kind: "rebuy", victimId: 1 });
    expect(first.deleteIds).toHaveLength(1);
    expect(first.patches).toEqual([{ participantId: 1, set: { rebuyCount: 1 } }]);
    const s2 = applyPlan(s1, first);
    expect(s2.participants[0]).toMatchObject({ rebuyCount: 1, currentBounty: 30, eliminatedByIds: [101] });
    expect(s2.participants[1]).toMatchObject({ currentBounty: 60, bountiesCollected: 20 });
    const s3 = applyPlan(s2, planUndo(s2, { kind: "rebuy", victimId: 1 }));
    expect(s3.participants).toEqual(s.participants);
    expect(s3.rows).toEqual([]);
  });

  it("Desfazer rebuy legado sem linhas de bounty tira o Bounty do rebuy da Vítima", () => {
    const s = makeSnapshot([30, 40]);
    s.participants[0].rebuyCount = 1;
    s.rows = [{ id: 1, playerId: 100, type: "rebuy", amount: 60, bountyChange: 0, relatedParticipantId: null, createdAt: "2026-01-01 00:00:00+00" }];
    const undone = applyPlan(s, planUndo(s, { kind: "rebuy", victimId: 1 }));
    expect(undone.participants[0]).toMatchObject({ rebuyCount: 0, currentBounty: 0 });
    expect(undone.rows).toEqual([]);
  });

  it("Desfazer rebuy preserva o que a Vítima acumulou depois como Eliminadora", () => {
    const s = makeSnapshot([40, 40, 40]);
    const s1 = applyPlan(s, planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 }), "2026-09-22 12:00:01+00");
    const s2 = applyPlan(s1, planKnockout(s1, { kind: "elimination", victimId: 3, eliminatorPlayerIds: [100] }), "2026-09-22 12:00:02+00");
    expect(s2.participants[0].currentBounty).toBe(50); // 30 + 20
    const undone = applyPlan(s2, planUndo(s2, { kind: "rebuy", victimId: 1 }));
    expect(undone.participants[0]).toMatchObject({ rebuyCount: 0, currentBounty: 60, bountiesCollected: 20 }); // 40 + 20 acumulado
    expect(undone.participants[1]).toMatchObject({ currentBounty: 40, bountiesCollected: 0 });
  });

  it("recusa Desfazer rebuy quando o Eliminador já foi Vítima depois", () => {
    const s = makeSnapshot([40, 40, 40]);
    const s1 = applyPlan(s, planKnockout(s, { kind: "rebuy", victimId: 1, eliminatorPlayerIds: [101], count: 1 }), "2026-09-22 12:00:01+00");
    const s2 = applyPlan(s1, planKnockout(s1, { kind: "elimination", victimId: 2, eliminatorPlayerIds: [102] }), "2026-09-22 12:00:02+00");
    expect(() => planUndo(s2, { kind: "rebuy", victimId: 1 })).toThrow(LedgerUndoBlockedError);
  });

  it("precondições do Desfazer rebuy", () => {
    const s = makeSnapshot([40, 40]);
    expect(checkUndo(s, { kind: "rebuy", victimId: 1 })).toEqual({ error: "Nenhum rebuy para desfazer" });
    s.participants[0].rebuyCount = 1;
    s.participants[0].status = "eliminated";
    expect(checkUndo(s, { kind: "rebuy", victimId: 1 })).toEqual({ error: "Desfaca a eliminacao antes de desfazer o rebuy" });
    s.participants[0].status = "playing";
    expect(checkUndo(s, { kind: "rebuy", victimId: 1 })).toBeNull();
  });
});

describe("Ledger de Knockout: fórmulas de Bounty", () => {
  it("Bounty inicial e de rebuy: percentual do valor líquido, zero em torneio normal", () => {
    expect(initialBounty(RULES)).toBe(40); // floor((100 - 20) * 50 / 100)
    expect(rebuyBounty(RULES)).toBe(30); // floor(60 * 50 / 100)
    expect(initialBounty({ ...RULES, tournamentType: "normal" })).toBe(0);
    expect(rebuyBounty({ ...RULES, tournamentType: "normal" })).toBe(0);
    expect(initialBounty({ ...RULES, buyInAmount: 55, rankingFeeAmount: 10, bountyPercentage: 33 })).toBe(14); // floor(45 * 0.33)
  });

  it("divisão: 1 Eliminador, Bounty par (100) → metade dinheiro / metade Bounty", () => {
    expect(splitBounty(100, [10])).toEqual([{ playerId: 10, amount: 50, bountyChange: 50 }]);
  });

  it("divisão: Bounty zero gera uma parte zero por Eliminador; sem Eliminadores → vazio; ids repetidos contam uma vez", () => {
    expect(splitBounty(0, [10, 11])).toEqual([
      { playerId: 10, amount: 0, bountyChange: 0 },
      { playerId: 11, amount: 0, bountyChange: 0 },
    ]);
    expect(splitBounty(100, [])).toEqual([]);
    expect(splitBounty(100, [10, 10])).toEqual([{ playerId: 10, amount: 50, bountyChange: 50 }]);
  });

  it("divisão: resto inteiro vai aos primeiros índices (101 entre 2 → 25+25 / 26+25)", () => {
    expect(splitBounty(101, [10, 11])).toEqual([
      { playerId: 10, amount: 25, bountyChange: 26 },
      { playerId: 11, amount: 25, bountyChange: 25 },
    ]);
  });

  it("divisão conserva o total: soma(amount) + soma(bountyChange) === Bounty, p/ valores e Ns variados", () => {
    for (const b of [1, 7, 100, 101, 333]) {
      for (const n of [1, 2, 3, 5]) {
        const ids = Array.from({ length: n }, (_, i) => i + 1);
        const total = splitBounty(b, ids).reduce((s, t) => s + t.amount + t.bountyChange, 0);
        expect(total).toBe(b);
      }
    }
  });
});

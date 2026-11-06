import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatCurrency } from "@/lib/format";
import type { MesaSnapshot } from "@/db/queries/mesa";
import { makeInput, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

function prizePool(snapshot: MesaSnapshot) {
  return buildMesaPanels(makeInput({ snapshot })).prizePool;
}

describe("card Prize pool", () => {
  it("mostra o Prize pool: Arrecadado menos o Fundo de ranking", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "normal", rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), makeParticipant(), makeParticipant({ status: "registered", buyInPaid: false })],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 5000, prize: 0, bounty_earned: 0 },
    });
    const { card } = prizePool(snapshot);

    expect(card).toEqual({ label: "Prize pool", value: formatCurrency(31000), supportLines: [] });
  });

  it("em Bounty Builder desconta também o Bounty armado", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder", rankingFeeAmount: 2000 }),
      participants: [
        makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
        makeParticipant({ status: "eliminated", currentBounty: 0 }),
      ],
      financialSummary: { buy_in: 20000, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { card } = prizePool(snapshot);

    expect(card.value).toBe(formatCurrency(20000 - 4000 - 10000));
  });
});

describe("painel Prize pool", () => {
  it("em torneio normal mostra a conta do Arrecadado ao Prize pool, sem a linha do Bounty armado", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "normal", rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), makeParticipant(), makeParticipant({ status: "registered", buyInPaid: false })],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 5000, prize: 0, bounty_earned: 0 },
    });
    const { panel } = prizePool(snapshot);

    expect(panel).toEqual({
      buyIns: 20000,
      rebuys: 10000,
      addons: 5000,
      collected: 35000,
      rankingFund: 4000,
      bountyAllocated: null,
      prizePool: 31000,
      prizesPaid: null,
      structure: null,
      moneyLine: null,
      nextOut: null,
      prizedPositionsAboveBuyIns: null,
    });
  });

  it("em Bounty Builder a conta desconta também o Bounty armado, em jogo e coletado", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder", rankingFeeAmount: 2000 }),
      participants: [
        makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
        makeParticipant({ status: "eliminated", currentBounty: 0 }),
      ],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { panel } = prizePool(snapshot);

    expect(panel).toMatchObject({
      collected: 30000,
      rankingFund: 4000,
      bountyAllocated: 10000,
      prizePool: 16000,
    });
  });

  it("em Bounty Builder a linha do Bounty armado aparece mesmo zerada", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder" }),
      participants: [makeParticipant({ status: "registered", buyInPaid: false })],
    });
    const { panel } = prizePool(snapshot);

    expect(panel.bountyAllocated).toBe(0);
  });

  it("sem Prêmios pagos não mostra Prêmios pagos nem Saldo", () => {
    const snapshot = makeSnapshot({
      participants: [makeParticipant()],
      financialSummary: { buy_in: 10000, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { panel } = prizePool(snapshot);

    expect(panel.prizesPaid).toBeNull();
  });

  it("com Prêmios pagos mostra o total pago e o Saldo", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), makeParticipant({ status: "finished", finishPosition: 1 })],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 0, prize: 20000, bounty_earned: 0 },
    });
    const { panel } = prizePool(snapshot);

    expect(panel.prizePool).toBe(26000);
    expect(panel.prizesPaid).toEqual({ total: 20000, balance: 6000 });
  });

  it("mostra o Saldo como está, mesmo negativo", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ rankingFeeAmount: 0 }),
      participants: [makeParticipant()],
      financialSummary: { buy_in: 10000, rebuy: 0, addon: 0, prize: 15000, bounty_earned: 0 },
    });
    const { panel } = prizePool(snapshot);

    expect(panel.prizesPaid).toEqual({ total: 15000, balance: -5000 });
  });

  it("o Prize pool do painel é o mesmo da face do card", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder", rankingFeeAmount: 2000 }),
      participants: [makeParticipant({ currentBounty: 5000, bountiesCollected: 5000 }), makeParticipant({ currentBounty: 5000 })],
      financialSummary: { buy_in: 30000, rebuy: 10000, addon: 5000, prize: 1000, bounty_earned: 0 },
    });
    const { card, panel } = prizePool(snapshot);

    expect(panel.prizePool).toBe(45000 - 4000 - 15000);
    expect(card.value).toBe(formatCurrency(26000));
  });
});

// Prize pool de R$ 310 (sem taxa de ranking, para não variar com o número de
// participantes). Com 50/30/20, o arredondamento de Prêmios da página
// do torneio dá R$ 155 / R$ 95 / R$ 60 (nunca 20% × R$ 310 = R$ 62).
function withStructure({
  playing,
  eliminated = 0,
  prizeStructure = [
    { position: 1, percentage: 50 },
    { position: 2, percentage: 30 },
    { position: 3, percentage: 20 },
  ],
}: {
  playing: number;
  eliminated?: number;
  prizeStructure?: MesaSnapshot["prizeStructure"];
}) {
  return makeSnapshot({
    tournament: makeTournament({ tournamentType: "normal", rankingFeeAmount: 0 }),
    participants: [
      ...Array.from({ length: playing }, () => makeParticipant()),
      ...Array.from({ length: eliminated }, () => makeParticipant({ status: "eliminated" })),
    ],
    financialSummary: { buy_in: 28000, rebuy: 3000, addon: 0, prize: 0, bounty_earned: 0 },
    prizeStructure,
  });
}

describe("painel Prize pool: linha de dinheiro", () => {
  it("as Posições premiadas ignoram posição com percentual 0", () => {
    const snapshot = withStructure({
      playing: 4,
      prizeStructure: [
        { position: 1, percentage: 70 },
        { position: 2, percentage: 30 },
        { position: 3, percentage: 0 },
      ],
    });

    expect(prizePool(snapshot).panel.moneyLine).toEqual({
      prizedPositions: 2,
      playing: 4,
      remaining: 2,
      state: "beforeMoney",
    });
  });

  it("com Em jogo uma acima das Posições premiadas é Bolha", () => {
    expect(prizePool(withStructure({ playing: 4 })).panel.moneyLine).toEqual({
      prizedPositions: 3,
      playing: 4,
      remaining: 1,
      state: "bubble",
    });
  });

  it("com Em jogo igual às Posições premiadas está No dinheiro", () => {
    expect(prizePool(withStructure({ playing: 3, eliminated: 1 })).panel.moneyLine).toMatchObject({
      remaining: 0,
      state: "inTheMoney",
    });
  });

  it("com Em jogo abaixo das Posições premiadas continua No dinheiro, com faltam negativo", () => {
    expect(prizePool(withStructure({ playing: 2, eliminated: 2 })).panel.moneyLine).toMatchObject({
      remaining: -1,
      state: "inTheMoney",
    });
  });

  it("com 1 Em jogo a linha de dinheiro aparece, No dinheiro", () => {
    expect(prizePool(withStructure({ playing: 1, eliminated: 3 })).panel.moneyLine).toMatchObject({
      playing: 1,
      state: "inTheMoney",
    });
  });

  it("sem ninguém Em jogo (antes do primeiro buy-in ou depois da Coroação) não há linha de dinheiro", () => {
    const beforeFirstBuyIn = withStructure({ playing: 0 });
    const afterCoronation = makeSnapshot({
      ...withStructure({ playing: 0, eliminated: 3 }),
    });
    afterCoronation.participants.push(makeParticipant({ status: "finished", finishPosition: 1 }));

    expect(prizePool(beforeFirstBuyIn).panel.moneyLine).toBeNull();
    expect(prizePool(afterCoronation).panel.moneyLine).toBeNull();
  });
});

describe("painel Prize pool: Estrutura de prêmios", () => {
  it("mostra percentual e Prêmio estimado de cada posição, com o arredondamento da página do torneio", () => {
    const { panel } = prizePool(withStructure({ playing: 4 }));

    expect(panel.prizePool).toBe(31000);
    expect(panel.structure).toEqual({
      positions: [
        { position: 1, percentage: 50, estimatedPrize: 15500 },
        { position: 2, percentage: 30, estimatedPrize: 9500 },
        { position: 3, percentage: 20, estimatedPrize: 6000 },
      ],
      paysThroughPosition: 3,
    });
  });

  it("a linha até onde paga fica na última posição com percentual maior que zero", () => {
    const { panel } = prizePool(
      withStructure({
        playing: 4,
        prizeStructure: [
          { position: 1, percentage: 70 },
          { position: 2, percentage: 30 },
          { position: 3, percentage: 0 },
        ],
      })
    );

    expect(panel.structure?.paysThroughPosition).toBe(2);
    expect(panel.structure?.positions.map((p) => p.estimatedPrize)).toEqual([21500, 9500, 0]);
  });

  it("sem Estrutura a seção fica vazia e a conta do Prize pool continua", () => {
    const { panel } = prizePool(withStructure({ playing: 4, prizeStructure: [] }));

    expect(panel.structure).toBeNull();
    expect(panel.moneyLine).toBeNull();
    expect(panel.nextOut).toBeNull();
    expect(panel).toMatchObject({ collected: 31000, rankingFund: 0, prizePool: 31000 });
  });

  it("sem Posições premiadas a seção fica vazia", () => {
    const { panel } = prizePool(withStructure({ playing: 4, prizeStructure: [{ position: 1, percentage: 0 }] }));

    expect(panel.structure).toBeNull();
    expect(panel.moneyLine).toBeNull();
  });
});

describe("painel Prize pool: o próximo a cair", () => {
  it("No dinheiro, o próximo a cair termina na posição igual ao número de Em jogo e leva o Prêmio estimado dela", () => {
    const { panel } = prizePool(withStructure({ playing: 3, eliminated: 1 }));

    expect(panel.nextOut).toEqual({ position: 3, prize: 6000 });
  });

  it("antes do dinheiro e na Bolha não há o próximo a cair", () => {
    expect(prizePool(withStructure({ playing: 5 })).panel.nextOut).toBeNull();
    expect(prizePool(withStructure({ playing: 4 })).panel.nextOut).toBeNull();
  });

  it("com 1 Em jogo não há o próximo a cair", () => {
    expect(prizePool(withStructure({ playing: 1, eliminated: 3 })).panel.nextOut).toBeNull();
  });

  it("sem ninguém Em jogo não há o próximo a cair", () => {
    expect(prizePool(withStructure({ playing: 0 })).panel.nextOut).toBeNull();
  });
});

describe("painel Prize pool: aviso de Posições premiadas acima dos Participantes com buy-in", () => {
  // 3 Posições premiadas e só 2 Participantes com buy-in (um terceiro ainda Aguardando buy-in).
  function overpaid() {
    const snapshot = withStructure({ playing: 2 });
    snapshot.participants.push(makeParticipant({ status: "registered", buyInPaid: false }));
    return snapshot;
  }

  it("aparece para o admin", () => {
    const { panel } = buildMesaPanels(makeInput({ snapshot: overpaid(), isAdmin: true })).prizePool;

    expect(panel.prizedPositionsAboveBuyIns).toEqual({ prizedPositions: 3, buyIns: 2 });
  });

  it("não aparece para o jogador", () => {
    const { panel } = buildMesaPanels(makeInput({ snapshot: overpaid(), isAdmin: false })).prizePool;

    expect(panel.prizedPositionsAboveBuyIns).toBeNull();
  });

  it("não aparece quando as Posições premiadas não passam dos Participantes com buy-in", () => {
    const { panel } = buildMesaPanels(makeInput({ snapshot: withStructure({ playing: 3 }), isAdmin: true })).prizePool;

    expect(panel.prizedPositionsAboveBuyIns).toBeNull();
  });

  it("não muda a Estrutura e a linha de dinheiro segue as Posições premiadas da Estrutura", () => {
    const { panel } = buildMesaPanels(makeInput({ snapshot: overpaid(), isAdmin: true })).prizePool;

    expect(panel.structure?.positions).toEqual([
      { position: 1, percentage: 50, estimatedPrize: 15500 },
      { position: 2, percentage: 30, estimatedPrize: 9500 },
      { position: 3, percentage: 20, estimatedPrize: 6000 },
    ]);
    expect(panel.moneyLine).toEqual({ prizedPositions: 3, playing: 2, remaining: -1, state: "inTheMoney" });
    expect(panel.nextOut).toEqual({ position: 2, prize: 9500 });
  });
});

describe("card Prize pool: 1º estimado", () => {
  it("mostra o Prêmio estimado da 1ª posição", () => {
    const { card } = prizePool(withStructure({ playing: 4 }));

    expect(card.supportLines).toEqual([`1º ${formatCurrency(15500)}`]);
  });

  it("sem Estrutura não mostra a linha", () => {
    const { card } = prizePool(withStructure({ playing: 4, prizeStructure: [] }));

    expect(card.supportLines).toEqual([]);
  });
});

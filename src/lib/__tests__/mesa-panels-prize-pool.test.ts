import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatCurrency } from "@/lib/format";
import type { MesaSnapshot } from "@/db/queries/mesa";
import { makeInput, makeParticipant, makeSnapshot, makeTournament, payPrizes } from "./mesa-panels-fixture";

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
      paidPrizesByPosition: null,
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
    const champion = makeParticipant({ status: "finished", finishPosition: 1 });
    const snapshot = makeSnapshot({
      tournament: makeTournament({ rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), champion],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { panel } = prizePool(payPrizes(snapshot, [[champion, 20000]]));

    expect(panel.prizePool).toBe(26000);
    expect(panel.prizesPaid).toEqual({ total: 20000, balance: 6000 });
  });

  it("mostra o Saldo como está, mesmo negativo", () => {
    const player = makeParticipant();
    const snapshot = makeSnapshot({
      tournament: makeTournament({ rankingFeeAmount: 0 }),
      participants: [player],
      financialSummary: { buy_in: 10000, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { panel } = prizePool(payPrizes(snapshot, [[player, 15000]]));

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
      paysThrough: 2,
      playing: 4,
      remaining: 2,
      state: "beforeMoney",
    });
  });

  it("com Em jogo uma acima das Posições premiadas é Bolha", () => {
    expect(prizePool(withStructure({ playing: 4 })).panel.moneyLine).toEqual({
      paysThrough: 3,
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

  it("a linha até onde paga fica na última posição premiada", () => {
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
    expect(panel.moneyLine).toEqual({ paysThrough: 3, playing: 2, remaining: -1, state: "inTheMoney" });
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

// O editor aceita uma posição de 0% no meio. Prêmio garantido só vai até a última
// posição da sequência premiada a partir do 1º: aqui, o 2º (o 3º não leva nada).
// Com R$ 310: 60/30/0/10 → R$ 185 / R$ 95 / R$ 0 / R$ 30.
describe("painel Prize pool: Estrutura com posição de 0% no meio", () => {
  const gapped = [
    { position: 1, percentage: 60 },
    { position: 2, percentage: 30 },
    { position: 3, percentage: 0 },
    { position: 4, percentage: 10 },
  ];

  it("a linha até onde paga, o resumo e o faltam param no fim da sequência premiada a partir do 1º", () => {
    const { panel } = prizePool(withStructure({ playing: 4, prizeStructure: gapped }));

    expect(panel.structure).toEqual({
      positions: [
        { position: 1, percentage: 60, estimatedPrize: 18500 },
        { position: 2, percentage: 30, estimatedPrize: 9500 },
        { position: 3, percentage: 0, estimatedPrize: 0 },
        { position: 4, percentage: 10, estimatedPrize: 3000 },
      ],
      paysThroughPosition: 2,
    });
    expect(panel.moneyLine).toEqual({ paysThrough: 2, playing: 4, remaining: 2, state: "beforeMoney" });
  });

  it("com 3 Em jogo é Bolha, porque quem cair em 3º não leva Prêmio", () => {
    const { panel } = prizePool(withStructure({ playing: 3, eliminated: 1, prizeStructure: gapped }));

    expect(panel.moneyLine).toMatchObject({ remaining: 1, state: "bubble" });
    expect(panel.nextOut).toBeNull();
  });

  it("No dinheiro, o próximo a cair nunca leva R$ 0", () => {
    const { panel } = prizePool(withStructure({ playing: 2, eliminated: 2, prizeStructure: gapped }));

    expect(panel.moneyLine).toMatchObject({ remaining: 0, state: "inTheMoney" });
    expect(panel.nextOut).toEqual({ position: 2, prize: 9500 });
  });

  it("o aviso do admin conta todas as Posições premiadas da Estrutura", () => {
    const snapshot = withStructure({ playing: 2, prizeStructure: gapped });
    const { panel } = buildMesaPanels(makeInput({ snapshot, isAdmin: true })).prizePool;

    expect(panel.prizedPositionsAboveBuyIns).toEqual({ prizedPositions: 3, buyIns: 2 });
  });

  it("com o 1º em 0% não há linha de dinheiro nem linha até onde paga", () => {
    const { panel } = prizePool(
      withStructure({
        playing: 2,
        prizeStructure: [
          { position: 1, percentage: 0 },
          { position: 2, percentage: 100 },
        ],
      })
    );

    expect(panel.structure?.paysThroughPosition).toBe(0);
    expect(panel.moneyLine).toBeNull();
    expect(panel.nextOut).toBeNull();
  });
});

// Distribuir prêmios grava a Posição final junto com o Prêmio. Prize pool de R$ 310
// com 50/30/20 (o `withStructure`), acordo na mesa final com 3 Em jogo.
describe("painel Prize pool: Prêmios pagos", () => {
  it("lista o Prêmio pago de cada pessoa, pelo nome de exibição, ordenado pela Posição final", () => {
    const snapshot = withStructure({ playing: 0 });
    const ana = makeParticipant({ name: "Ana Souza", nickname: null, finishPosition: 2 });
    const bigode = makeParticipant({ name: "Carlos Lima", nickname: "Bigode", finishPosition: 1 });
    const caio = makeParticipant({ name: "Caio", finishPosition: 3 });
    snapshot.participants.push(ana, bigode, caio);

    const { panel } = prizePool(
      payPrizes(snapshot, [
        [ana, 9000],
        [caio, 6000],
        [bigode, 16000],
      ])
    );

    expect(panel.paidPrizesByPosition).toEqual([
      { participantId: bigode.id, name: "Bigode", finishPosition: 1, amount: 16000 },
      { participantId: ana.id, name: "Ana Souza", finishPosition: 2, amount: 9000 },
      { participantId: caio.id, name: "Caio", finishPosition: 3, amount: 6000 },
    ]);
  });

  it("quem tem Prêmio pago e está sem Posição final aparece no fim, sem posição", () => {
    const snapshot = withStructure({ playing: 0 });
    const undone = makeParticipant({ name: "Desfeito", status: "playing", finishPosition: null });
    const first = makeParticipant({ name: "Primeiro", finishPosition: 1 });
    const second = makeParticipant({ name: "Segundo", finishPosition: 2 });
    snapshot.participants.push(undone, first, second);

    const { panel } = prizePool(
      payPrizes(snapshot, [
        [undone, 5000],
        [first, 15000],
        [second, 10000],
      ])
    );

    expect(panel.paidPrizesByPosition?.map((p) => [p.name, p.finishPosition])).toEqual([
      ["Primeiro", 1],
      ["Segundo", 2],
      ["Desfeito", null],
    ]);
  });

  it("Posição final repetida aparece como está, na ordem de inscrição", () => {
    const snapshot = withStructure({ playing: 0 });
    const a = makeParticipant({ name: "Zeca", finishPosition: 2 });
    const b = makeParticipant({ name: "Abel", finishPosition: 2 });
    const c = makeParticipant({ name: "Rui", finishPosition: 1 });
    snapshot.participants.push(a, b, c);

    const { panel } = prizePool(
      payPrizes(snapshot, [
        [b, 8000],
        [a, 8000],
        [c, 15000],
      ])
    );

    expect(panel.paidPrizesByPosition?.map((p) => [p.name, p.finishPosition])).toEqual([
      ["Rui", 1],
      ["Zeca", 2],
      ["Abel", 2],
    ]);
  });

  it("substitui os Prêmios estimados e a linha até onde paga, e desliga a linha de dinheiro e o próximo a cair", () => {
    // 3 Em jogo com 50/30/20 estaria No dinheiro, com o próximo a cair em 3º.
    const snapshot = withStructure({ playing: 3, eliminated: 1 });
    const [first, second, third] = snapshot.participants;

    const { panel } = prizePool(
      payPrizes(snapshot, [
        [first, 14000],
        [second, 10000],
        [third, 7000],
      ])
    );

    expect(panel.paidPrizesByPosition).toHaveLength(3);
    expect(panel.structure).toBeNull();
    expect(panel.moneyLine).toBeNull();
    expect(panel.nextOut).toBeNull();
  });

  it("funciona sem Estrutura de prêmios", () => {
    const snapshot = withStructure({ playing: 0, prizeStructure: [] });
    const champion = makeParticipant({ name: "Campeao", status: "finished", finishPosition: 1 });
    snapshot.participants.push(champion);

    const { panel, card } = prizePool(payPrizes(snapshot, [[champion, 31000]]));

    expect(panel.paidPrizesByPosition).toEqual([
      { participantId: champion.id, name: "Campeao", finishPosition: 1, amount: 31000 },
    ]);
    expect(panel.prizesPaid).toEqual({ total: 31000, balance: 0 });
    expect(card.supportLines).toEqual([`1º ${formatCurrency(31000)}`]);
  });

  it("o aviso do admin continua seguindo a Estrutura de prêmios", () => {
    // 3 Posições premiadas e só 2 Participantes com buy-in.
    const snapshot = withStructure({ playing: 2 });
    const [first, second] = snapshot.participants;
    const paid = payPrizes(snapshot, [
      [first, 20000],
      [second, 11000],
    ]);

    const { panel } = buildMesaPanels(makeInput({ snapshot: paid, isAdmin: true })).prizePool;

    expect(panel.prizedPositionsAboveBuyIns).toEqual({ prizedPositions: 3, buyIns: 2 });
  });

  it("sem Prêmios pagos não há lista de pagos", () => {
    expect(prizePool(withStructure({ playing: 4 })).panel.paidPrizesByPosition).toBeNull();
  });
});

describe("card Prize pool: 1º pago", () => {
  // Acordo na mesa final com 2 Em jogo: a distribuição grava a posição em quem
  // ainda está Em jogo.
  it("mostra o Prêmio pago de quem tem Posição final 1, no lugar do estimado", () => {
    const snapshot = withStructure({ playing: 0, eliminated: 1 });
    const first = makeParticipant({ finishPosition: 1 });
    const second = makeParticipant({ finishPosition: 2 });
    snapshot.participants.push(first, second);

    const { card } = prizePool(
      payPrizes(snapshot, [
        [first, 18000],
        [second, 13000],
      ])
    );

    expect(card.supportLines).toEqual([`1º ${formatCurrency(18000)}`]);
  });

  it("sem ninguém com Prêmio pago na posição 1 não mostra a linha", () => {
    const snapshot = withStructure({ playing: 1, eliminated: 1 });
    const first = makeParticipant({ finishPosition: 2 });
    snapshot.participants.push(first);

    const { card } = prizePool(payPrizes(snapshot, [[first, 9000]]));

    expect(card.supportLines).toEqual([]);
  });
});

// O resumo financeiro soma todos os registros de Prêmio do torneio; a lista por
// Participante só os de quem ainda é Participante (um Participante removido deixa o
// registro órfão) e vem de outra leitura. A mesa segue só a lista, para a conta, a
// tabela e a linha de dinheiro nunca discordarem.
describe("painel Prize pool: Prêmios pagos vêm só da lista por Participante", () => {
  it("total pago no resumo sem ninguém na lista: estado normal, com estimados e linha de dinheiro", () => {
    const snapshot = withStructure({ playing: 4 });
    const orphaned = { ...snapshot, financialSummary: { ...snapshot.financialSummary, prize: 5000 } };

    const { panel, card } = prizePool(orphaned);

    expect(panel.prizesPaid).toBeNull();
    expect(panel.paidPrizesByPosition).toBeNull();
    expect(panel.structure?.paysThroughPosition).toBe(3);
    expect(panel.moneyLine).toMatchObject({ state: "bubble" });
    expect(card.supportLines).toEqual([`1º ${formatCurrency(15500)}`]);
  });

  it("a linha Prêmios pagos e o Saldo somam só a lista", () => {
    const snapshot = withStructure({ playing: 0 });
    const champion = makeParticipant({ name: "Campeao", status: "finished", finishPosition: 1 });
    snapshot.participants.push(champion);
    const paid = payPrizes(snapshot, [[champion, 20000]]);
    // Mais R$ 50 de um Participante já removido.
    const withOrphan = { ...paid, financialSummary: { ...paid.financialSummary, prize: 25000 } };

    const { panel } = prizePool(withOrphan);

    expect(panel.prizesPaid).toEqual({ total: 20000, balance: 11000 });
    expect(panel.paidPrizesByPosition?.map((p) => p.amount)).toEqual([20000]);
  });

  it("Prêmio de quem não está entre os participantes lidos não conta", () => {
    const snapshot = withStructure({ playing: 4 });
    const stale = { ...snapshot, paidPrizesByParticipant: [{ participantId: 999999, amount: 5000 }] };

    const { panel } = prizePool(stale);

    expect(panel.prizesPaid).toBeNull();
    expect(panel.paidPrizesByPosition).toBeNull();
    expect(panel.moneyLine).toMatchObject({ state: "bubble" });
  });
});

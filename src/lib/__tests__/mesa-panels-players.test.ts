import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import type { MesaParticipant, MesaPrizePosition, MesaTournament } from "@/db/queries/mesa";
import { makeInput, makeParticipant, makeSnapshot, makeTournament, payPrizes } from "./mesa-panels-fixture";

describe("card Jogadores", () => {
  it("mostra quantos estão Em jogo e quantos têm buy-in confirmado", () => {
    const participants = [
      makeParticipant(),
      makeParticipant(),
      makeParticipant({ status: "eliminated", finishPosition: 3 }),
      makeParticipant({ status: "registered", buyInPaid: false }),
    ];
    const { card } = buildMesaPanels(makeInput({ snapshot: makeSnapshot({ participants }) })).players;

    expect(card).toEqual({ label: "Jogadores", value: "2", supportLines: ["de 3 com buy-in"] });
  });
});

function playersPanel(participants: MesaParticipant[], tournament?: Partial<MesaTournament>) {
  const snapshot = makeSnapshot({ participants, tournament: makeTournament(tournament) });
  const { panel } = buildMesaPanels(makeInput({ snapshot })).players;
  return panel;
}

describe("painel Jogadores: contagens", () => {
  it("conta Em jogo, com buy-in, Eliminações e Aguardando buy-in pelo status do Participante", () => {
    const panel = playersPanel([
      makeParticipant(),
      makeParticipant(),
      makeParticipant({ status: "eliminated", finishPosition: 5 }),
      makeParticipant({ status: "eliminated", finishPosition: 4 }),
      makeParticipant({ status: "registered", buyInPaid: false }),
    ]);

    expect(panel.counts).toEqual({ playing: 2, withBuyIn: 4, eliminated: 2, awaitingBuyIn: 1 });
  });

  it("Participante Em jogo com Posição final gravada por distribuição continua Em jogo", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Ana", finishPosition: 1 }),
      makeParticipant({ name: "Bia", finishPosition: 2 }),
      makeParticipant({ name: "Caio", status: "eliminated", finishPosition: 3 }),
    ]);

    expect(panel.counts).toEqual({ playing: 2, withBuyIn: 3, eliminated: 1, awaitingBuyIn: 0 });
    expect(panel.playing.map((p) => p.name)).toEqual(["Ana", "Bia"]);
    expect(panel.eliminations.map((p) => p.name)).toEqual(["Caio"]);
  });
});

describe("painel Jogadores: lista dos Em jogo", () => {
  it("ordena pelo nome de exibição: o apelido ou, sem apelido, o nome", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Zeca", nickname: null }),
      makeParticipant({ name: "Alberto", nickname: "Tio" }),
      makeParticipant({ name: "Érica", nickname: null }),
      makeParticipant({ name: "Mário", nickname: "Bigode" }),
      makeParticipant({ name: "Fabio", nickname: null }),
    ]);

    expect(panel.playing.map((p) => p.name)).toEqual(["Bigode", "Érica", "Fabio", "Tio", "Zeca"]);
  });
});

describe("painel Jogadores: marcas e Bounty dos Em jogo", () => {
  it("marca quantos Rebuys e add-ons cada um fez e se usou o bônus", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Ana", rebuyCount: 2, addonCount: 1, bonusChipUsed: true }),
      makeParticipant({ name: "Bia" }),
    ]);

    expect(panel.playing).toEqual([
      expect.objectContaining({ name: "Ana", rebuys: 2, addons: 1, bonus: true }),
      expect.objectContaining({ name: "Bia", rebuys: 0, addons: 0, bonus: false }),
    ]);
  });

  it("mostra o Bounty de cada Em jogo em Bounty Builder", () => {
    const panel = playersPanel(
      [makeParticipant({ name: "Ana", currentBounty: 7500 }), makeParticipant({ name: "Bia", currentBounty: 5000 })],
      { tournamentType: "bounty_builder" }
    );

    expect(panel.playing.map((p) => p.bounty)).toEqual([7500, 5000]);
  });

  it("não mostra Bounty em torneio normal", () => {
    const panel = playersPanel([makeParticipant({ name: "Ana", currentBounty: 7500 })]);

    expect(panel.playing[0].bounty).toBeNull();
  });
});

describe("painel Jogadores: Eliminações", () => {
  it("ordena pela Posição final, da menor para a maior: a mais recente primeiro", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Primeiro a cair", status: "eliminated", finishPosition: 9 }),
      makeParticipant({ name: "Ultimo a cair", status: "eliminated", finishPosition: 7 }),
      makeParticipant({ name: "Segundo a cair", status: "eliminated", finishPosition: 8 }),
      makeParticipant({ name: "Ainda Em jogo" }),
    ]);

    expect(panel.eliminations).toEqual([
      expect.objectContaining({ name: "Ultimo a cair", finishPosition: 7 }),
      expect.objectContaining({ name: "Segundo a cair", finishPosition: 8 }),
      expect.objectContaining({ name: "Primeiro a cair", finishPosition: 9 }),
    ]);
  });

  it("mostra Posição final repetida como está gravada e desempata pela ordem de entrada", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Zeca", status: "eliminated", finishPosition: 5 }),
      makeParticipant({ name: "Ana", status: "eliminated", finishPosition: 6 }),
      makeParticipant({ name: "Bia", status: "eliminated", finishPosition: 5 }),
    ]);

    expect(panel.eliminations.map((p) => [p.finishPosition, p.name])).toEqual([
      [5, "Zeca"],
      [5, "Bia"],
      [6, "Ana"],
    ]);
  });
});

describe("painel Jogadores: campeão e Aguardando buy-in", () => {
  it("destaca o campeão depois da Coroação", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Ana", nickname: "Rainha", status: "finished", finishPosition: 1 }),
      makeParticipant({ name: "Bia", status: "eliminated", finishPosition: 2 }),
    ]);

    expect(panel.champion).toEqual(expect.objectContaining({ name: "Rainha" }));
    expect(panel.counts.playing).toBe(0);
  });

  it("o destaque some quando a Coroação é desfeita e o Participante volta a ficar Em jogo", () => {
    const ana = makeParticipant({ name: "Ana", status: "finished", finishPosition: 1 });
    const bia = makeParticipant({ name: "Bia", status: "eliminated", finishPosition: 2 });
    expect(playersPanel([ana, bia]).champion).toEqual(expect.objectContaining({ name: "Ana" }));

    const panel = playersPanel([
      { ...ana, status: "playing", finishPosition: null },
      { ...bia, status: "playing", finishPosition: null },
    ]);

    expect(panel.champion).toBeNull();
    expect(panel.playing.map((p) => p.name)).toEqual(["Ana", "Bia"]);
  });

  it("lista quem está Aguardando buy-in numa seção própria, fora dos Em jogo", () => {
    const panel = playersPanel([
      makeParticipant({ name: "Ana" }),
      makeParticipant({ name: "Zeca", status: "registered", buyInPaid: false }),
      makeParticipant({ name: "Bia", nickname: "Bibi", status: "registered", buyInPaid: false }),
    ]);

    expect(panel.awaitingBuyIn.map((p) => p.name)).toEqual(["Bibi", "Zeca"]);
    expect(panel.playing.map((p) => p.name)).toEqual(["Ana"]);
  });
});

// Linha de dinheiro (#84): a mesma derivação do Prize pool (`deriveMoneyLine`).
const PAYS_THREE = [
  { position: 1, percentage: 50 },
  { position: 2, percentage: 30 },
  { position: 3, percentage: 20 },
];

function playersSlice(participants: MesaParticipant[], prizeStructure: MesaPrizePosition[] = PAYS_THREE) {
  return buildMesaPanels(makeInput({ snapshot: makeSnapshot({ participants, prizeStructure }) })).players;
}

// N Em jogo e mais uma Eliminação, que conta no "com buy-in".
function playersWithPlaying(playing: number, prizeStructure?: MesaPrizePosition[]) {
  const participants = [
    ...Array.from({ length: playing }, () => makeParticipant()),
    makeParticipant({ status: "eliminated", finishPosition: playing + 1 }),
  ];
  return playersSlice(participants, prizeStructure);
}

const beforeFirstBuyIn = () => [
  makeParticipant({ status: "registered", buyInPaid: false }),
  makeParticipant({ status: "registered", buyInPaid: false }),
];

const afterCoronation = () => [
  makeParticipant({ status: "finished", finishPosition: 1 }),
  makeParticipant({ status: "eliminated", finishPosition: 2 }),
  makeParticipant({ status: "eliminated", finishPosition: 3 }),
];

describe("card Jogadores: linha de dinheiro", () => {
  it("antes do dinheiro mostra quantas Eliminações faltam", () => {
    expect(playersWithPlaying(5).card.supportLines).toEqual(["de 6 com buy-in", "faltam 2 p/ o dinheiro"]);
  });

  it("na Bolha mostra Bolha", () => {
    expect(playersWithPlaying(4).card.supportLines).toEqual(["de 5 com buy-in", "Bolha"]);
  });

  it("No dinheiro não mostra nada da linha", () => {
    expect(playersWithPlaying(3).card.supportLines).toEqual(["de 4 com buy-in"]);
  });

  it("com 1 Em jogo não mostra nada da linha", () => {
    expect(playersWithPlaying(1).card.supportLines).toEqual(["de 2 com buy-in"]);
  });

  it("antes do primeiro buy-in e depois da Coroação não mostra a linha", () => {
    expect(playersSlice(beforeFirstBuyIn()).card.supportLines).toEqual(["de 0 com buy-in"]);
    expect(playersSlice(afterCoronation()).card.supportLines).toEqual(["de 3 com buy-in"]);
  });

  it("sem Posições premiadas não mostra a linha", () => {
    expect(playersWithPlaying(5, []).card.supportLines).toEqual(["de 6 com buy-in"]);
    expect(playersWithPlaying(5, [{ position: 1, percentage: 0 }]).card.supportLines).toEqual(["de 6 com buy-in"]);
  });
});

describe("painel Jogadores: linha de dinheiro", () => {
  it("antes do dinheiro diz quantas Eliminações faltam e até onde paga", () => {
    expect(playersWithPlaying(5).panel.moneyLine).toEqual({
      paysThrough: 3,
      playing: 5,
      remaining: 2,
      state: "beforeMoney",
    });
  });

  it("com uma Eliminação para o dinheiro está na Bolha", () => {
    expect(playersWithPlaying(4).panel.moneyLine).toMatchObject({ remaining: 1, state: "bubble" });
  });

  it("com Em jogo igual à fronteira está No dinheiro", () => {
    expect(playersWithPlaying(3).panel.moneyLine).toMatchObject({ remaining: 0, state: "inTheMoney" });
  });

  it("com 1 Em jogo está No dinheiro", () => {
    expect(playersWithPlaying(1).panel.moneyLine).toMatchObject({ playing: 1, state: "inTheMoney" });
  });

  it("é a mesma do painel do Prize pool", () => {
    const participants = [makeParticipant(), makeParticipant(), makeParticipant(), makeParticipant()];
    const snapshot = makeSnapshot({ participants, prizeStructure: PAYS_THREE });
    const view = buildMesaPanels(makeInput({ snapshot }));
    expect(view.players.panel.moneyLine).toEqual(view.prizePool.panel.moneyLine);
  });

  it("antes do primeiro buy-in e depois da Coroação não há linha", () => {
    expect(playersSlice(beforeFirstBuyIn()).panel.moneyLine).toBeNull();
    expect(playersSlice(afterCoronation()).panel.moneyLine).toBeNull();
  });

  it("sem Posições premiadas não há linha", () => {
    expect(playersWithPlaying(5, []).panel.moneyLine).toBeNull();
    expect(playersWithPlaying(5, [{ position: 1, percentage: 0 }]).panel.moneyLine).toBeNull();
  });
});

// Acordo na mesa final: 4 Em jogo com 3 Posições premiadas seria Bolha, mas com
// Prêmios pagos a linha de dinheiro se desliga no painel e no card.
describe("Jogadores com Prêmios pagos", () => {
  function afterDeal() {
    const participants = [makeParticipant(), makeParticipant(), makeParticipant(), makeParticipant()];
    const snapshot = makeSnapshot({ participants, prizeStructure: PAYS_THREE });
    return payPrizes(snapshot, [
      [participants[0], 10000],
      [participants[1], 6000],
    ]);
  }

  it("não há linha de dinheiro no painel", () => {
    expect(buildMesaPanels(makeInput({ snapshot: afterDeal() })).players.panel.moneyLine).toBeNull();
  });

  it("a face não mostra Bolha nem faltam", () => {
    expect(buildMesaPanels(makeInput({ snapshot: afterDeal() })).players.card.supportLines).toEqual([
      "de 4 com buy-in",
    ]);
  });
});

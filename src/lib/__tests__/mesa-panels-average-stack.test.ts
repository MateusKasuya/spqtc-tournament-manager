import { describe, it, expect } from "vitest";
import {
  buildMesaPanels,
  findCurrentLevel,
  findReturnLevel,
  formatAverageInBigBlinds,
  formatAverageStack,
} from "@/lib/mesa-panels";
import { formatChips } from "@/lib/format";
import type { MesaLevel, MesaParticipant, MesaTournament } from "@/db/queries/mesa";
import { makeInput, makeLevel, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

const chips = { initialChips: 10000, rebuyChips: 10000, addonChips: 15000, bonusChipAmount: 2000 };

function averageStack({
  participants,
  blindLevels = [makeLevel(1)],
  tournament = {},
}: {
  participants: MesaParticipant[];
  blindLevels?: MesaLevel[];
  tournament?: Partial<MesaTournament>;
}) {
  const snapshot = makeSnapshot({ tournament: makeTournament({ ...chips, ...tournament }), participants, blindLevels });
  return buildMesaPanels(makeInput({ snapshot })).averageStack;
}

// 4 buy-ins = 40.000 fichas para 2 Em jogo: Stack médio de 20.000.
function twoPlayingOf40k() {
  return [
    makeParticipant(),
    makeParticipant(),
    makeParticipant({ status: "eliminated" }),
    makeParticipant({ status: "eliminated" }),
  ];
}

describe("Nível atual", () => {
  it("é o Nível cujo número é o Nível atual do Relógio", () => {
    const levels = [makeLevel(1), makeLevel(2), makeLevel(3)];

    expect(findCurrentLevel(makeTournament({ currentBlindLevel: 2 }), levels)?.level).toBe(2);
  });

  it("com o Relógio no Nível 0 é o primeiro Nível da estrutura", () => {
    const levels = [makeLevel(2), makeLevel(1)];

    expect(findCurrentLevel(makeTournament({ currentBlindLevel: 0 }), levels)?.level).toBe(1);
  });

  it("sem estrutura de blinds não há Nível atual", () => {
    expect(findCurrentLevel(makeTournament({ currentBlindLevel: 1 }), [])).toBeNull();
  });
});

describe("Nível de retorno", () => {
  const levels = [makeLevel(1), makeLevel(2, { isBreak: true }), makeLevel(3)];

  it("fora de Intervalo não existe", () => {
    expect(findReturnLevel(makeTournament({ currentBlindLevel: 1 }), levels)).toBeNull();
  });

  it("num Intervalo da estrutura é o próximo Nível", () => {
    expect(findReturnLevel(makeTournament({ currentBlindLevel: 2 }), levels)?.level).toBe(3);
  });

  it("num Intervalo da estrutura que é o último Nível não existe", () => {
    const endingInBreak = [makeLevel(1), makeLevel(2, { isBreak: true })];

    expect(findReturnLevel(makeTournament({ currentBlindLevel: 2 }), endingInBreak)).toBeNull();
  });

  it("num Intervalo avulso é o próprio Nível interrompido", () => {
    expect(findReturnLevel(makeTournament({ currentBlindLevel: 1, breakActive: true }), levels)?.level).toBe(1);
  });

  it("num Intervalo avulso iniciado durante um Intervalo da estrutura é o Nível interrompido", () => {
    expect(findReturnLevel(makeTournament({ currentBlindLevel: 2, breakActive: true }), levels)?.level).toBe(2);
  });
});

describe("card Stack médio", () => {
  it("divide as Fichas em jogo pelos Participantes em jogo e mostra em big blinds", () => {
    // 3 buy-ins + 1 add-on = 45.000 fichas para 2 Em jogo; big blind 400 → 56,25 BB.
    const { card } = averageStack({
      participants: [makeParticipant({ addonCount: 1 }), makeParticipant(), makeParticipant({ status: "eliminated" })],
      blindLevels: [makeLevel(1), makeLevel(2)],
      tournament: { currentBlindLevel: 2 },
    });

    expect(card).toEqual({ label: "Stack medio", value: formatChips(22500), supportLines: ["≈ 56 BB"] });
  });

  it("arredonda só na exibição", () => {
    // 4 buy-ins + 2 bônus = 44.000 fichas para 3 Em jogo ≈ 14.666,7; big blind 200 ≈ 73,3 BB.
    const { card } = averageStack({
      participants: [
        makeParticipant({ bonusChipUsed: true }),
        makeParticipant({ bonusChipUsed: true }),
        makeParticipant(),
        makeParticipant({ status: "eliminated" }),
      ],
    });

    expect(card.value).toBe(formatChips(14667));
    expect(card.supportLines).toEqual(["≈ 73 BB"]);
  });

  it("sem ninguém Em jogo mostra — no valor e nos big blinds", () => {
    const { card } = averageStack({ participants: [makeParticipant({ status: "registered", buyInPaid: false })] });

    expect(card).toEqual({ label: "Stack medio", value: "—", supportLines: ["—"] });
  });

  it("sem Nível válido mostra o Stack médio em fichas e — nos big blinds", () => {
    const { card } = averageStack({ participants: twoPlayingOf40k(), blindLevels: [] });

    expect(card.value).toBe(formatChips(20000));
    expect(card.supportLines).toEqual(["—"]);
  });
});

describe("painel Stack médio", () => {
  it("mostra a conta aberta, o Stack médio em fichas e o big blind do Nível atual", () => {
    const { panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1), makeLevel(2), makeLevel(3)],
      tournament: { currentBlindLevel: 2 },
    });

    expect(panel).toEqual({
      chipsInPlay: 40000,
      playingCount: 2,
      average: 20000,
      bigBlind: 400,
      nextLevel: { level: 3, bigBlind: 600 },
    });
  });

  it("mostra o mesmo Stack médio, em fichas e em big blinds, que a face do card", () => {
    // 44.000 fichas para 3 Em jogo; big blind 600.
    const { card, panel } = averageStack({
      participants: [
        makeParticipant({ bonusChipUsed: true }),
        makeParticipant({ bonusChipUsed: true }),
        makeParticipant(),
        makeParticipant({ status: "eliminated" }),
      ],
      blindLevels: [makeLevel(3)],
      tournament: { currentBlindLevel: 3 },
    });

    expect(formatAverageStack(panel.average)).toBe(card.value);
    expect(formatAverageInBigBlinds(panel.average, panel.bigBlind)).toBe(card.supportLines[0]);
    expect(card.value).toBe(formatChips(14667));
    expect(card.supportLines).toEqual(["≈ 24 BB"]);
  });

  it("sem ninguém Em jogo fica sem Stack médio e mostra —", () => {
    const { panel } = averageStack({ participants: [makeParticipant({ status: "eliminated" })] });

    expect(panel.playingCount).toBe(0);
    expect(panel.average).toBeNull();
    expect(formatAverageStack(panel.average)).toBe("—");
    expect(formatAverageInBigBlinds(panel.average, panel.bigBlind)).toBe("—");
  });

  it("num Intervalo da estrutura usa o big blind do próximo Nível", () => {
    const { panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1), makeLevel(2, { isBreak: true, bigBlind: 0 }), makeLevel(3), makeLevel(4)],
      tournament: { currentBlindLevel: 2 },
    });

    expect(panel.bigBlind).toBe(600);
    expect(panel.nextLevel).toEqual({ level: 4, bigBlind: 800 });
  });

  it("num Intervalo avulso usa o big blind do Nível interrompido", () => {
    const { panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1), makeLevel(2), makeLevel(3)],
      tournament: { currentBlindLevel: 2, breakActive: true },
    });

    expect(panel.bigBlind).toBe(400);
    expect(panel.nextLevel).toEqual({ level: 3, bigBlind: 600 });
  });

  it("com big blind 0 no Nível fica sem conversão", () => {
    const { card, panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1, { bigBlind: 0 }), makeLevel(2)],
    });

    expect(panel.bigBlind).toBeNull();
    expect(card.supportLines).toEqual(["—"]);
  });

  it("no último Nível não tem próximo Nível", () => {
    const { panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1), makeLevel(2)],
      tournament: { currentBlindLevel: 2 },
    });

    expect(panel.nextLevel).toBeNull();
  });

  it("com o Relógio no Nível 0 usa o primeiro Nível e o segundo como próximo", () => {
    const { panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1), makeLevel(2)],
      tournament: { currentBlindLevel: 0 },
    });

    expect(panel.bigBlind).toBe(200);
    expect(panel.nextLevel).toEqual({ level: 2, bigBlind: 400 });
  });

  it("quando o seguinte é um Intervalo da estrutura, o próximo Nível é o primeiro depois dele", () => {
    const { panel } = averageStack({
      participants: twoPlayingOf40k(),
      blindLevels: [makeLevel(1), makeLevel(2, { isBreak: true, bigBlind: 0 }), makeLevel(3)],
      tournament: { currentBlindLevel: 1 },
    });

    expect(panel.nextLevel).toEqual({ level: 3, bigBlind: 600 });
  });
});

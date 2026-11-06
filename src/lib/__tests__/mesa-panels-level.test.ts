import { describe, it, expect } from "vitest";
import { buildMesaPanels, findNextLevel } from "@/lib/mesa-panels";
import type { MesaLevel, MesaTournament } from "@/db/queries/mesa";
import { makeInput, makeLevel, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

function levelPanel({
  blindLevels,
  tournament = {},
  remainingSeconds = 0,
}: {
  blindLevels: MesaLevel[];
  tournament?: Partial<MesaTournament>;
  remainingSeconds?: number;
}) {
  const snapshot = makeSnapshot({ tournament: makeTournament(tournament), blindLevels });
  return buildMesaPanels(makeInput({ snapshot, remainingSeconds })).level.panel;
}

// Relógio já iniciado e parado com 5 minutos no Nível atual.
const paused5min = { timerRemainingSecs: 300 };

describe("painel Nível: estrutura de blinds", () => {
  it("lista os Níveis em ordem com o Nível atual marcado", () => {
    const panel = levelPanel({
      blindLevels: [makeLevel(3), makeLevel(1), makeLevel(2)],
      tournament: { currentBlindLevel: 2, ...paused5min },
    });

    expect(panel.levels.map((l) => [l.level, l.isCurrent])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
  });

  it("com o Relógio no Nível 0 marca o primeiro Nível", () => {
    const panel = levelPanel({
      blindLevels: [makeLevel(1), makeLevel(2)],
      tournament: { currentBlindLevel: 0 },
    });

    expect(panel.levels.filter((l) => l.isCurrent).map((l) => l.level)).toEqual([1]);
  });

  it("traz os blinds de cada Nível e sinaliza os Intervalos da estrutura e o Nível do add-on", () => {
    const panel = levelPanel({
      blindLevels: [
        makeLevel(1, { ante: 25 }),
        makeLevel(2, { isBreak: true, durationMinutes: 10 }),
        makeLevel(3, { isAddonLevel: true, isBigAnte: true, ante: 600 }),
      ],
    });

    expect(panel.levels).toEqual([
      { level: 1, smallBlind: 100, bigBlind: 200, ante: 25, isBigAnte: false, durationMinutes: 20, isBreak: false, isAddonLevel: false, isCurrent: true },
      { level: 2, smallBlind: 200, bigBlind: 400, ante: 0, isBigAnte: false, durationMinutes: 10, isBreak: true, isAddonLevel: false, isCurrent: false },
      { level: 3, smallBlind: 300, bigBlind: 600, ante: 600, isBigAnte: true, durationMinutes: 20, isBreak: false, isAddonLevel: true, isCurrent: false },
    ]);
  });

  it("sem estrutura de blinds a lista é vazia e não há tempo até o Intervalo", () => {
    const panel = levelPanel({ blindLevels: [] });

    expect(panel).toEqual({ levels: [], secondsToNextBreak: null });
  });
});

describe("painel Nível: tempo até o próximo Intervalo da estrutura", () => {
  // Nível 1 e 2 de jogo (20min cada), Intervalo da estrutura no 3, Nível 4 de jogo.
  const levels = [makeLevel(1), makeLevel(2), makeLevel(3, { isBreak: true, durationMinutes: 10 }), makeLevel(4)];

  it("é o Tempo restante do Nível atual mais a duração dos Níveis até o Intervalo", () => {
    const panel = levelPanel({
      blindLevels: levels,
      tournament: { currentBlindLevel: 1, timerRunning: true, timerRemainingSecs: 900, timerStartedAt: new Date() },
      remainingSeconds: 400,
    });

    expect(panel.secondsToNextBreak).toBe(400 + 20 * 60);
  });

  it("no Nível logo antes do Intervalo é só o Tempo restante do Nível atual", () => {
    const panel = levelPanel({
      blindLevels: levels,
      tournament: { currentBlindLevel: 2, ...paused5min },
      remainingSeconds: 300,
    });

    expect(panel.secondsToNextBreak).toBe(300);
  });

  it("com o Relógio parado em zero não usa a duração cheia", () => {
    const panel = levelPanel({
      blindLevels: levels,
      tournament: { currentBlindLevel: 2, timerRemainingSecs: 0 },
      remainingSeconds: 0,
    });

    expect(panel.secondsToNextBreak).toBe(0);
  });

  it("durante um Intervalo avulso soma o que resta do Intervalo e o Tempo restante guardado do Nível interrompido", () => {
    const panel = levelPanel({
      blindLevels: levels,
      tournament: {
        currentBlindLevel: 1,
        breakActive: true,
        breakTotalSecs: 600,
        levelRemainingSecs: 700,
        timerRunning: true,
        timerRemainingSecs: 600,
        timerStartedAt: new Date(),
      },
      remainingSeconds: 240,
    });

    expect(panel.secondsToNextBreak).toBe(240 + 700 + 20 * 60);
  });

  it("com o Relógio nunca iniciado usa a duração cheia do Nível atual, como no Iniciar", () => {
    const panel = levelPanel({
      blindLevels: levels,
      tournament: { currentBlindLevel: 0, timerRunning: false, timerRemainingSecs: null },
      remainingSeconds: 0,
    });

    expect(panel.secondsToNextBreak).toBe(20 * 60 + 20 * 60);
  });

  it("num Intervalo da estrutura conta até o Intervalo da estrutura seguinte", () => {
    const twoBreaks = [
      makeLevel(1),
      makeLevel(2, { isBreak: true, durationMinutes: 10 }),
      makeLevel(3),
      makeLevel(4, { isBreak: true, durationMinutes: 10 }),
    ];
    const panel = levelPanel({
      blindLevels: twoBreaks,
      tournament: { currentBlindLevel: 2, ...paused5min },
      remainingSeconds: 300,
    });

    expect(panel.secondsToNextBreak).toBe(300 + 20 * 60);
  });

  it("sem Intervalo da estrutura à frente não há tempo até o Intervalo", () => {
    const panel = levelPanel({
      blindLevels: levels,
      tournament: { currentBlindLevel: 3, ...paused5min },
      remainingSeconds: 300,
    });

    expect(panel.secondsToNextBreak).toBeNull();
  });
});

describe("próximo Nível", () => {
  const levels = [makeLevel(1), makeLevel(2, { isBreak: true }), makeLevel(3)];

  it("é o Nível seguinte, mesmo que seja um Intervalo da estrutura", () => {
    expect(findNextLevel(makeLevel(1), levels)?.level).toBe(2);
  });

  it("no último Nível não existe", () => {
    expect(findNextLevel(makeLevel(3), levels)).toBeNull();
  });
});

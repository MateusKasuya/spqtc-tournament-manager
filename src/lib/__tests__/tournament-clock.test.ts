import { describe, it, expect } from "vitest";
import {
  remainingSecs,
  startTimer,
  pauseTimer,
  advanceLevel,
  goBackLevel,
  expireLevel,
  startBreak,
  endBreak,
  toIsoOrNull,
  type ClockState,
  type ClockLevel,
} from "@/lib/tournament-clock";

const NOW = new Date("2026-09-22T12:00:00.000Z");

const LEVELS: ClockLevel[] = [
  { level: 1, durationMinutes: 15, isBreak: false },
  { level: 2, durationMinutes: 20, isBreak: false },
  { level: 3, durationMinutes: 25, isBreak: false },
];

const BASE: ClockState = {
  currentBlindLevel: 1,
  timerRunning: false,
  timerRemainingSecs: null,
  timerStartedAt: null,
  breakActive: false,
  levelRemainingSecs: null,
  breakTotalSecs: null,
};

describe("Relógio do torneio: Tempo restante", () => {
  it("parado, é o valor gravado", () => {
    expect(remainingSecs({ ...BASE, timerRemainingSecs: 300 }, NOW)).toBe(300);
  });

  it("nunca negativo mesmo se o valor gravado for negativo", () => {
    expect(remainingSecs({ ...BASE, timerRemainingSecs: -10 }, NOW)).toBe(0);
  });

  it("correndo, decresce os segundos inteiros desde timerStartedAt, com piso em zero", () => {
    const startedAt = new Date(NOW.getTime() - 10_000);
    const state: ClockState = { ...BASE, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 100 };
    expect(remainingSecs(state, NOW)).toBe(90);

    const longAgo = new Date(NOW.getTime() - 1_000_000);
    expect(remainingSecs({ ...state, timerStartedAt: longAgo }, NOW)).toBe(0);
  });
});

describe("Relógio do torneio: Iniciar", () => {
  it("recusa 'Sem estrutura de blinds' quando não há Níveis", () => {
    const result = startTimer(BASE, [], NOW);
    expect(result).toEqual({ ok: false, error: "Sem estrutura de blinds" });
  });

  it("sem Tempo restante gravado, usa a duração cheia do Nível atual", () => {
    const result = startTimer(BASE, LEVELS, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.timerRemainingSecs).toBe(15 * 60);
      expect(result.state.timerRunning).toBe(true);
      expect(result.state.timerStartedAt).toBe(NOW);
    }
  });

  it("com Tempo restante já gravado, preserva o valor (retomar de uma Pausa)", () => {
    const result = startTimer({ ...BASE, timerRemainingSecs: 42 }, LEVELS, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.timerRemainingSecs).toBe(42);
  });
});

describe("Relógio do torneio: Pausar", () => {
  it("recusa 'Timer nao esta rodando' quando não está correndo", () => {
    expect(pauseTimer(BASE, NOW)).toEqual({ ok: false, error: "Timer nao esta rodando" });
  });

  it("recusa quando timerRunning é true mas sem timerStartedAt (estado inconsistente)", () => {
    expect(pauseTimer({ ...BASE, timerRunning: true, timerStartedAt: null }, NOW)).toEqual({
      ok: false,
      error: "Timer nao esta rodando",
    });
  });

  it("grava o Tempo restante daquele instante e limpa timerStartedAt", () => {
    const startedAt = new Date(NOW.getTime() - 5_000);
    const state: ClockState = { ...BASE, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 100 };
    const result = pauseTimer(state, NOW);
    expect(result).toEqual({
      ok: true,
      state: { ...state, timerRunning: false, timerStartedAt: null, timerRemainingSecs: 95 },
    });
  });

  it("iniciar e pausar em instantes conhecidos preserva o Tempo restante (round-trip)", () => {
    const started = startTimer({ ...BASE, timerRemainingSecs: 600 }, LEVELS, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const fiveMinutesLater = new Date(NOW.getTime() + 5 * 60_000);
    const paused = pauseTimer(started.state, fiveMinutesLater);
    expect(paused.ok).toBe(true);
    if (paused.ok) expect(paused.state.timerRemainingSecs).toBe(300);
  });
});

describe("Relógio do torneio: Avançar", () => {
  it("aponta pro próximo Nível com a duração cheia e preserva 'correndo'", () => {
    const startedAt = new Date(NOW.getTime() - 1000);
    const state: ClockState = { ...BASE, currentBlindLevel: 1, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 10 };
    const result = advanceLevel(state, LEVELS, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.currentBlindLevel).toBe(2);
      expect(result.state.timerRemainingSecs).toBe(20 * 60);
      expect(result.state.timerRunning).toBe(true);
      expect(result.state.timerStartedAt).toBe(NOW);
    }
  });

  it("se estava pausado, avança e permanece pausado (sem timerStartedAt)", () => {
    const result = advanceLevel({ ...BASE, currentBlindLevel: 1, timerRunning: false }, LEVELS, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.timerRunning).toBe(false);
      expect(result.state.timerStartedAt).toBeNull();
    }
  });

  it("recusa 'Ja esta no ultimo nivel' quando não há próximo Nível", () => {
    const result = advanceLevel({ ...BASE, currentBlindLevel: 3 }, LEVELS, NOW);
    expect(result).toEqual({ ok: false, error: "Ja esta no ultimo nivel" });
  });
});

describe("Relógio do torneio: Voltar", () => {
  it("aponta pro Nível anterior com a duração cheia e sempre pausado, mesmo se estava correndo", () => {
    const state: ClockState = { ...BASE, currentBlindLevel: 3, timerRunning: true, timerStartedAt: NOW, timerRemainingSecs: 10 };
    const result = goBackLevel(state, LEVELS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.currentBlindLevel).toBe(2);
      expect(result.state.timerRemainingSecs).toBe(20 * 60);
      expect(result.state.timerRunning).toBe(false);
      expect(result.state.timerStartedAt).toBeNull();
    }
  });

  it("recusa 'Ja esta no primeiro nivel' quando não há Nível anterior", () => {
    const result = goBackLevel({ ...BASE, currentBlindLevel: 1 }, LEVELS);
    expect(result).toEqual({ ok: false, error: "Ja esta no primeiro nivel" });
  });
});

describe("Relógio do torneio: Fim do nível", () => {
  it("instante observado diferente do gravado: nada a fazer (outra tela já processou)", () => {
    const state: ClockState = { ...BASE, currentBlindLevel: 1, timerRunning: true, timerStartedAt: NOW, timerRemainingSecs: 0 };
    const result = expireLevel(state, LEVELS, "2020-01-01T00:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, changed: false });
  });

  it("instante observado coincide: avança pro próximo Nível", () => {
    const state: ClockState = { ...BASE, currentBlindLevel: 1, timerRunning: true, timerStartedAt: NOW, timerRemainingSecs: 0 };
    const result = expireLevel(state, LEVELS, toIsoOrNull(NOW), NOW);
    expect(result.ok).toBe(true);
    if (result.ok && result.changed) expect(result.state.currentBlindLevel).toBe(2);
  });

  it("no último Nível: nada a fazer, sem erro (Relógio fica em zero)", () => {
    const state: ClockState = { ...BASE, currentBlindLevel: 3, timerRunning: true, timerStartedAt: NOW, timerRemainingSecs: 0 };
    const result = expireLevel(state, LEVELS, toIsoOrNull(NOW), NOW);
    expect(result).toEqual({ ok: true, changed: false });
  });

  it("com Intervalo avulso ativo e instante coincidente: encerra o intervalo em vez de avançar", () => {
    const state: ClockState = {
      ...BASE,
      currentBlindLevel: 1,
      timerRunning: true,
      timerStartedAt: NOW,
      timerRemainingSecs: 0,
      breakActive: true,
      levelRemainingSecs: 321,
      breakTotalSecs: 600,
    };
    const result = expireLevel(state, LEVELS, toIsoOrNull(NOW), NOW);
    expect(result.ok).toBe(true);
    if (result.ok && result.changed) {
      expect(result.state.breakActive).toBe(false);
      expect(result.state.currentBlindLevel).toBe(1);
      expect(result.state.timerRemainingSecs).toBe(321);
      expect(result.state.timerRunning).toBe(false);
    }
  });

  it("com Intervalo avulso ativo e instante defasado: nada a fazer (a trava age antes do branch de intervalo)", () => {
    const state: ClockState = {
      ...BASE,
      timerRunning: true,
      timerStartedAt: NOW,
      breakActive: true,
      levelRemainingSecs: 321,
      breakTotalSecs: 600,
    };
    const result = expireLevel(state, LEVELS, "2020-01-01T00:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, changed: false });
  });

  it("Intervalo da estrutura (isBreak: true) avança como qualquer outro Nível", () => {
    const levelsWithBreak: ClockLevel[] = [
      { level: 1, durationMinutes: 15, isBreak: false },
      { level: 2, durationMinutes: 5, isBreak: true },
      { level: 3, durationMinutes: 20, isBreak: false },
    ];
    const state: ClockState = { ...BASE, currentBlindLevel: 1, timerRunning: true, timerStartedAt: NOW, timerRemainingSecs: 0 };
    const result = expireLevel(state, levelsWithBreak, toIsoOrNull(NOW), NOW);
    expect(result.ok).toBe(true);
    if (result.ok && result.changed) {
      expect(result.state.currentBlindLevel).toBe(2);
      expect(result.state.timerRemainingSecs).toBe(5 * 60);
    }
  });
});

describe("Relógio do torneio: Intervalo avulso", () => {
  it("Iniciar guarda o Tempo restante do Nível (Relógio correndo) e liga o intervalo", () => {
    const startedAt = new Date(NOW.getTime() - 10_000);
    const state: ClockState = { ...BASE, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 100 };
    const result = startBreak(state, 10, NOW);
    expect(result.breakActive).toBe(true);
    expect(result.levelRemainingSecs).toBe(90);
    expect(result.breakTotalSecs).toBe(10 * 60);
    expect(result.timerRemainingSecs).toBe(10 * 60);
    expect(result.timerRunning).toBe(true);
    expect(result.timerStartedAt).toBe(NOW);
  });

  it("Iniciar guarda o Tempo restante do Nível (Relógio pausado)", () => {
    const result = startBreak({ ...BASE, timerRunning: false, timerRemainingSecs: 500 }, 5, NOW);
    expect(result.levelRemainingSecs).toBe(500);
    expect(result.breakTotalSecs).toBe(5 * 60);
  });

  it("Encerrar sem intervalo ativo é sucesso sem mudança (idempotente)", () => {
    expect(endBreak({ ...BASE, breakActive: false })).toEqual({ ok: true, changed: false });
  });

  it("Encerrar devolve o Tempo restante guardado do Nível, pausado, e limpa os campos do intervalo", () => {
    const state: ClockState = {
      ...BASE,
      timerRunning: true,
      timerStartedAt: NOW,
      timerRemainingSecs: 300,
      breakActive: true,
      levelRemainingSecs: 777,
      breakTotalSecs: 600,
    };
    const result = endBreak(state);
    expect(result.ok).toBe(true);
    if (result.ok && result.changed) {
      expect(result.state).toEqual({
        ...state,
        breakActive: false,
        levelRemainingSecs: null,
        breakTotalSecs: null,
        timerRemainingSecs: 777,
        timerRunning: false,
        timerStartedAt: null,
      });
    }
  });

  it("round-trip: Iniciar seguido de Encerrar (sem tempo decorrido) devolve o Tempo restante original do Nível", () => {
    const state: ClockState = { ...BASE, timerRunning: true, timerStartedAt: NOW, timerRemainingSecs: 543 };
    const started = startBreak(state, 15, NOW);
    const ended = endBreak(started);
    expect(ended.ok).toBe(true);
    if (ended.ok && ended.changed) expect(ended.state.timerRemainingSecs).toBe(543);
  });
});

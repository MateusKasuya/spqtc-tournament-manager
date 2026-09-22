import { describe, it, expect } from "vitest";
import { remainingSecs, startTimer, pauseTimer, type ClockState, type ClockLevel } from "@/lib/tournament-clock";

const NOW = new Date("2026-09-22T12:00:00.000Z");

const LEVELS: ClockLevel[] = [
  { level: 1, durationMinutes: 15, isBreak: false },
  { level: 2, durationMinutes: 20, isBreak: false },
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

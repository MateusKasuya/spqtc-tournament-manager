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
  clockTone,
  ringTotalSecs,
  fromRawRow,
  reanchorLevel,
  type ClockState,
  type ReanchorLevel,
  type ClockLevel,
  type ClockRawRow,
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

  it("sem Nível correspondente a currentBlindLevel, usa a duração do primeiro Nível (não 15 minutos fixos)", () => {
    const levels: ClockLevel[] = [
      { level: 1, durationMinutes: 20, isBreak: false },
      { level: 2, durationMinutes: 25, isBreak: false },
    ];
    const result = startTimer({ ...BASE, currentBlindLevel: 0 }, levels, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.timerRemainingSecs).toBe(20 * 60);
  });

  it("chamado com o Relógio já rodando é idempotente (não reinicia o instante nem o Tempo restante)", () => {
    const startedAt = new Date(NOW.getTime() - 5_000);
    const state: ClockState = { ...BASE, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 100 };
    expect(startTimer(state, LEVELS, NOW)).toEqual({ ok: true, state });
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

describe("Relógio do torneio: Tom de cor", () => {
  it("intervalo tem precedência sobre qualquer outra faixa", () => {
    expect(clockTone(0, true, true)).toBe("break");
    expect(clockTone(30, false, true)).toBe("break");
  });

  it("zero: correndo e chegou a zero (fora de intervalo)", () => {
    expect(clockTone(0, true, false)).toBe("zero");
  });

  it("zero gravado mas parado não é 'zero' (Relógio pausado no zero)", () => {
    expect(clockTone(0, false, false)).toBe("normal");
  });

  it("aviso: último minuto (1 a 60s), fora de intervalo", () => {
    expect(clockTone(60, true, false)).toBe("warning");
    expect(clockTone(1, false, false)).toBe("warning");
  });

  it("normal: mais de 60s restantes, fora de intervalo", () => {
    expect(clockTone(61, true, false)).toBe("normal");
  });
});

describe("Relógio do torneio: denominador do anel de progresso", () => {
  it("fora de intervalo, usa a duração cheia do Nível atual", () => {
    expect(ringTotalSecs({ ...BASE, currentBlindLevel: 2 }, LEVELS)).toBe(20 * 60);
  });

  it("com Intervalo avulso ativo, usa a duração total do intervalo", () => {
    expect(
      ringTotalSecs({ ...BASE, currentBlindLevel: 1, breakActive: true, breakTotalSecs: 600 }, LEVELS)
    ).toBe(600);
  });

  it("sem Nível correspondente a currentBlindLevel, usa o primeiro Nível como fallback (torneio novo, currentBlindLevel 0)", () => {
    expect(ringTotalSecs({ ...BASE, currentBlindLevel: 0 }, LEVELS)).toBe(15 * 60);
  });

  it("sem Níveis configurados, devolve zero", () => {
    expect(ringTotalSecs({ ...BASE, currentBlindLevel: 1 }, [])).toBe(0);
  });
});

describe("Relógio do torneio: conversão da linha crua do realtime", () => {
  const PREV: ClockState = { ...BASE, currentBlindLevel: 1, timerRemainingSecs: 500 };

  it("linha completa substitui todos os campos e converte o instante para Date", () => {
    const row: ClockRawRow = {
      current_blind_level: 2,
      timer_running: true,
      timer_remaining_secs: 1200,
      timer_started_at: NOW.toISOString(),
      break_active: false,
      level_remaining_secs: null,
      break_total_secs: null,
    };
    const result = fromRawRow(PREV, row);
    expect(result.currentBlindLevel).toBe(2);
    expect(result.timerRunning).toBe(true);
    expect(result.timerRemainingSecs).toBe(1200);
    expect(result.timerStartedAt).toEqual(NOW);
    expect(result.timerStartedAt).toBeInstanceOf(Date);
  });

  it("timer_started_at nulo vira null, não uma Date inválida", () => {
    const result = fromRawRow(PREV, { timer_started_at: null });
    expect(result.timerStartedAt).toBeNull();
  });

  it("linha parcial preserva os campos ausentes do estado anterior", () => {
    const result = fromRawRow(PREV, { timer_running: true });
    expect(result.timerRunning).toBe(true);
    expect(result.currentBlindLevel).toBe(PREV.currentBlindLevel);
    expect(result.timerRemainingSecs).toBe(PREV.timerRemainingSecs);
    expect(result.breakActive).toBe(PREV.breakActive);
  });

  it("campos nuláveis chegando como null (não undefined) sobrescrevem o anterior", () => {
    const prevWithBreak: ClockState = { ...PREV, levelRemainingSecs: 42, breakTotalSecs: 600 };
    const result = fromRawRow(prevWithBreak, { level_remaining_secs: null, break_total_secs: null });
    expect(result.levelRemainingSecs).toBeNull();
    expect(result.breakTotalSecs).toBeNull();
  });
});

describe("Relógio do torneio: Reancorar ao editar a estrutura", () => {
  const level = (n: number, sb: number, durationMinutes = 15): ReanchorLevel => ({
    level: n,
    smallBlind: sb,
    bigBlind: sb * 2,
    ante: 0,
    durationMinutes,
    isBreak: false,
    isAddonLevel: false,
    isBigAnte: false,
  });
  const OLD = [level(1, 10), level(2, 20), level(3, 30), level(4, 40), level(5, 50)];
  const RUNNING: ClockState = {
    ...BASE,
    currentBlindLevel: 3,
    timerRunning: true,
    timerStartedAt: NOW,
    timerRemainingSecs: 777,
  };

  it("sem Nível antigo (torneio sem estrutura ou Nível 0), nada a fazer", () => {
    expect(reanchorLevel(RUNNING, null, OLD)).toEqual({ ok: true, changed: false });
  });

  it("Nível no mesmo número com o mesmo conteúdo, nada a fazer", () => {
    expect(reanchorLevel(RUNNING, OLD[2], OLD)).toEqual({ ok: true, changed: false });
  });

  it("reancora pelo conteúdo quando o Nível foi renumerado, sem mexer no Relógio", () => {
    const reordered = [OLD[2], OLD[0], OLD[1], OLD[3], OLD[4]].map((l, i) => ({ ...l, level: i + 1 }));
    const result = reanchorLevel(RUNNING, OLD[2], reordered);
    expect(result).toEqual({ ok: true, changed: true, state: { ...RUNNING, currentBlindLevel: 1 } });
  });

  it("Nível atual editado: preserva o número, pausa e reseta para a duração cheia", () => {
    const edited = OLD.map((l) => (l.level === 3 ? { ...l, durationMinutes: 20 } : l));
    const result = reanchorLevel(RUNNING, OLD[2], edited);
    expect(result).toEqual({
      ok: true,
      changed: true,
      state: { ...RUNNING, currentBlindLevel: 3, timerRunning: false, timerStartedAt: null, timerRemainingSecs: 20 * 60 },
    });
  });

  it("Nível atual removido: clampeia para o último Nível válido, pausado e resetado", () => {
    const state: ClockState = { ...RUNNING, currentBlindLevel: 5 };
    const shortened = [level(1, 10), level(2, 20), level(3, 30, 25)];
    const result = reanchorLevel(state, OLD[4], shortened);
    expect(result).toEqual({
      ok: true,
      changed: true,
      state: { ...state, currentBlindLevel: 3, timerRunning: false, timerStartedAt: null, timerRemainingSecs: 25 * 60 },
    });
  });

  it("estrutura esvaziada: Nível 1, pausado e sem Tempo restante gravado", () => {
    const result = reanchorLevel(RUNNING, OLD[2], []);
    expect(result).toEqual({
      ok: true,
      changed: true,
      state: { ...RUNNING, currentBlindLevel: 1, timerRunning: false, timerStartedAt: null, timerRemainingSecs: null },
    });
  });
});

// Núcleo puro do Relógio do torneio (CONTEXT.md, ADR 0002).
// Recebe o estado do Relógio, a lista de Níveis e o instante atual injetado, e
// devolve o próximo estado (ou uma recusa em pt-BR). Sem banco, sem relógio de
// máquina: todo instante chega por parâmetro.

export interface ClockState {
  currentBlindLevel: number;
  timerRunning: boolean;
  timerRemainingSecs: number | null;
  timerStartedAt: Date | null;
  breakActive: boolean;
  levelRemainingSecs: number | null;
  breakTotalSecs: number | null;
}

export interface ClockLevel {
  level: number;
  durationMinutes: number;
  isBreak: boolean;
}

export type ClockResult =
  | { ok: true; state: ClockState }
  | { ok: false; error: string };

// Tempo restante em qualquer instante: corrida decrescida do que já passou
// desde timerStartedAt, com piso em zero; parado, é o valor gravado.
export function remainingSecs(state: ClockState, now: Date): number {
  const stored = state.timerRemainingSecs ?? 0;
  if (!state.timerRunning || !state.timerStartedAt) {
    return Math.max(0, stored);
  }
  const elapsed = Math.floor((now.getTime() - state.timerStartedAt.getTime()) / 1000);
  return Math.max(0, stored - elapsed);
}

export function startTimer(state: ClockState, levels: ClockLevel[], now: Date): ClockResult {
  if (levels.length === 0) return { ok: false, error: "Sem estrutura de blinds" };

  let remaining = state.timerRemainingSecs;
  if (remaining === null || remaining === undefined) {
    const level = levels.find((l) => l.level === state.currentBlindLevel);
    remaining = (level?.durationMinutes ?? 15) * 60;
  }

  return {
    ok: true,
    state: { ...state, timerRunning: true, timerStartedAt: now, timerRemainingSecs: remaining },
  };
}

export function pauseTimer(state: ClockState, now: Date): ClockResult {
  if (!state.timerRunning || !state.timerStartedAt) {
    return { ok: false, error: "Timer nao esta rodando" };
  }

  return {
    ok: true,
    state: {
      ...state,
      timerRunning: false,
      timerStartedAt: null,
      timerRemainingSecs: remainingSecs(state, now),
    },
  };
}

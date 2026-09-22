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

export function toIsoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sortedLevels(levels: ClockLevel[]): ClockLevel[] {
  return [...levels].sort((a, b) => a.level - b.level);
}

// Avançar (clique manual ou Fim do nível): aponta pro próximo Nível com a
// duração cheia; mantém "correndo" se já estava, senão fica pausado.
export function advanceLevel(state: ClockState, levels: ClockLevel[], now: Date): ClockResult {
  const next = sortedLevels(levels).find((l) => l.level > state.currentBlindLevel);
  if (!next) return { ok: false, error: "Ja esta no ultimo nivel" };

  return {
    ok: true,
    state: {
      ...state,
      currentBlindLevel: next.level,
      timerRemainingSecs: next.durationMinutes * 60,
      timerStartedAt: state.timerRunning ? now : null,
    },
  };
}

// Voltar: correção, não fluxo — aponta pro Nível anterior com a duração
// cheia e sempre pausado, nunca continua correndo.
export function goBackLevel(state: ClockState, levels: ClockLevel[]): ClockResult {
  const sorted = sortedLevels(levels);
  const currentIndex = sorted.findIndex((l) => l.level === state.currentBlindLevel);
  const prev = currentIndex > 0 ? sorted[currentIndex - 1] : undefined;
  if (!prev) return { ok: false, error: "Ja esta no primeiro nivel" };

  return {
    ok: true,
    state: {
      ...state,
      currentBlindLevel: prev.level,
      timerRemainingSecs: prev.durationMinutes * 60,
      timerRunning: false,
      timerStartedAt: null,
    },
  };
}

export type ExpireLevelResult =
  | { ok: true; changed: false }
  | { ok: true; changed: true; state: ClockState }
  | { ok: false; error: string };

// Fim do nível: o instante de início observado pela tela é a trava. Se
// difere do gravado, outra tela já processou este zero — nada a fazer. Se
// coincide, avança; se não há próximo Nível, o Relógio fica em zero (sem
// erro — "Ja esta no ultimo nivel" é só para o clique manual).
export function expireLevel(
  state: ClockState,
  levels: ClockLevel[],
  observedTimerStartedAt: string | null,
  now: Date
): ExpireLevelResult {
  if (toIsoOrNull(state.timerStartedAt) !== observedTimerStartedAt) {
    return { ok: true, changed: false };
  }

  const advanced = advanceLevel(state, levels, now);
  if (!advanced.ok) return { ok: true, changed: false };

  return { ok: true, changed: true, state: advanced.state };
}

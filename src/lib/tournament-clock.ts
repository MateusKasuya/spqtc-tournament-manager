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
export function remainingSecs(
  state: Pick<ClockState, "timerRunning" | "timerRemainingSecs" | "timerStartedAt">,
  now: Date
): number {
  const stored = state.timerRemainingSecs ?? 0;
  if (!state.timerRunning || !state.timerStartedAt) {
    return Math.max(0, stored);
  }
  const elapsed = Math.floor((now.getTime() - state.timerStartedAt.getTime()) / 1000);
  return Math.max(0, stored - elapsed);
}

export function startTimer(state: ClockState, levels: ClockLevel[], now: Date): ClockResult {
  if (levels.length === 0) return { ok: false, error: "Sem estrutura de blinds" };
  if (state.timerRunning) return { ok: true, state };

  let remaining = state.timerRemainingSecs;
  if (remaining === null || remaining === undefined) {
    const sorted = sortedLevels(levels);
    const level = sorted.find((l) => l.level === state.currentBlindLevel) ?? sorted[0];
    remaining = level.durationMinutes * 60;
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

export type ClockChangeResult =
  | { ok: true; changed: false }
  | { ok: true; changed: true; state: ClockState }
  | { ok: false; error: string };

// Iniciar Intervalo avulso: sem recusa (a UI já limita as durações). Guarda
// o Tempo restante do Nível naquele instante e põe o Relógio correndo com a
// duração do intervalo.
export function startBreak(state: ClockState, durationMinutes: number, now: Date): ClockState {
  return {
    ...state,
    breakActive: true,
    levelRemainingSecs: remainingSecs(state, now),
    breakTotalSecs: durationMinutes * 60,
    timerRemainingSecs: durationMinutes * 60,
    timerRunning: true,
    timerStartedAt: now,
  };
}

// Encerrar Intervalo avulso: sem intervalo ativo é sucesso sem mudança
// (idempotente). Devolve o Tempo restante guardado do Nível, pausado.
export function endBreak(state: ClockState): ClockChangeResult {
  if (!state.breakActive) return { ok: true, changed: false };

  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      breakActive: false,
      levelRemainingSecs: null,
      breakTotalSecs: null,
      timerRemainingSecs: state.levelRemainingSecs ?? 0,
      timerRunning: false,
      timerStartedAt: null,
    },
  };
}

// Fim do nível: o instante de início observado pela tela é a trava. Se
// difere do gravado, outra tela já processou este zero — nada a fazer. Se
// coincide: com Intervalo avulso ativo, encerra o intervalo; senão avança
// (sem próximo Nível, o Relógio fica em zero — sem erro, que é só para o
// clique manual). Um Intervalo da estrutura é um Nível comum aqui: nada
// olha `isBreak` no caminho de Avançar.
export function expireLevel(
  state: ClockState,
  levels: ClockLevel[],
  observedTimerStartedAt: string | null,
  now: Date
): ClockChangeResult {
  if (toIsoOrNull(state.timerStartedAt) !== observedTimerStartedAt) {
    return { ok: true, changed: false };
  }

  if (state.breakActive) return endBreak(state);

  const advanced = advanceLevel(state, levels, now);
  if (!advanced.ok) return { ok: true, changed: false };

  return { ok: true, changed: true, state: advanced.state };
}

// Nível com o conteúdo completo da estrutura de blinds: Reancorar identifica
// o Nível pelo conteúdo, não pelo número.
export interface StructureLevel extends ClockLevel {
  smallBlind: number;
  bigBlind: number;
  ante: number;
  isAddonLevel: boolean;
  isBigAnte: boolean;
}

function sameContent(a: StructureLevel, b: StructureLevel): boolean {
  return (
    a.smallBlind === b.smallBlind &&
    a.bigBlind === b.bigBlind &&
    a.ante === b.ante &&
    a.durationMinutes === b.durationMinutes &&
    a.isBreak === b.isBreak &&
    a.isAddonLevel === b.isAddonLevel &&
    a.isBigAnte === b.isBigAnte
  );
}

// Reancorar ao editar a estrutura: o editor renumera todos os Níveis a cada
// edição, então o Nível atual é reencontrado pelo conteúdo do Nível antigo e
// passa a apontar pro novo número, sem mexer no Relógio. Se o conteúdo sumiu
// (o próprio Nível atual foi editado ou removido), preserva o número quando
// ele ainda existe, ou clampeia pro último válido; como não há como saber
// quanto tempo já tinha passado nesse Nível, pausa e reseta pra duração cheia.
export function reanchorLevel(
  state: ClockState,
  oldLevel: StructureLevel | null,
  newLevels: StructureLevel[]
): ClockChangeResult {
  if (!oldLevel) return { ok: true, changed: false };

  const matched = newLevels.find((l) => sameContent(l, oldLevel));
  if (matched) {
    if (matched.level === state.currentBlindLevel) return { ok: true, changed: false };
    return { ok: true, changed: true, state: { ...state, currentBlindLevel: matched.level } };
  }

  const stillExists = newLevels.some((l) => l.level === state.currentBlindLevel);
  const newLevel = stillExists
    ? state.currentBlindLevel
    : Math.max(1, Math.min(state.currentBlindLevel, newLevels.length));
  const newLevelRow = newLevels.find((l) => l.level === newLevel);

  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      currentBlindLevel: newLevel,
      timerRunning: false,
      timerStartedAt: null,
      timerRemainingSecs: newLevelRow ? newLevelRow.durationMinutes * 60 : null,
    },
  };
}

export type ClockTone = "normal" | "warning" | "zero" | "break";

// Tom de aviso do Relógio, usado pelo painel principal e pela barra fixa do
// topo para que nunca discordem (CONTEXT.md). Intervalo tem precedência;
// depois o zero com o Relógio correndo; depois o último minuto do Nível.
export function clockTone(remainingSeconds: number, isRunning: boolean, isBreak: boolean): ClockTone {
  if (isBreak) return "break";
  if (remainingSeconds === 0 && isRunning) return "zero";
  if (remainingSeconds > 0 && remainingSeconds <= 60) return "warning";
  return "normal";
}

// Denominador do anel de progresso: a duração total do Intervalo avulso
// enquanto ele está ativo, senão a duração cheia do Nível atual. Sem Nível
// correspondente a currentBlindLevel (torneio novo, currentBlindLevel 0),
// usa o primeiro Nível — mesmo fallback do Iniciar.
export function ringTotalSecs(
  state: Pick<ClockState, "currentBlindLevel" | "breakActive" | "breakTotalSecs">,
  levels: ClockLevel[]
): number {
  if (state.breakActive && state.breakTotalSecs) return state.breakTotalSecs;
  if (levels.length === 0) return 0;
  const sorted = sortedLevels(levels);
  const level = sorted.find((l) => l.level === state.currentBlindLevel) ?? sorted[0];
  return level.durationMinutes * 60;
}

// Linha crua do realtime (nomes snake_case das colunas). Espelha o shape do
// payload postgres_changes e do select direto na tabela de torneios.
export interface ClockRawRow {
  current_blind_level: number;
  timer_running: boolean;
  timer_remaining_secs: number | null;
  timer_started_at: string | null;
  break_active: boolean;
  level_remaining_secs: number | null;
  break_total_secs: number | null;
}

// Converte uma linha crua (parcial: nem todo select ou payload traz todas as
// colunas) para o tipo único do Relógio, preservando os campos ausentes do
// estado anterior.
export function fromRawRow(prev: ClockState, row: Partial<ClockRawRow>): ClockState {
  return {
    currentBlindLevel: row.current_blind_level ?? prev.currentBlindLevel,
    timerRunning: row.timer_running ?? prev.timerRunning,
    timerRemainingSecs:
      row.timer_remaining_secs !== undefined ? row.timer_remaining_secs : prev.timerRemainingSecs,
    timerStartedAt:
      row.timer_started_at !== undefined
        ? row.timer_started_at === null
          ? null
          : new Date(row.timer_started_at)
        : prev.timerStartedAt,
    breakActive: row.break_active !== undefined ? row.break_active : prev.breakActive,
    levelRemainingSecs:
      row.level_remaining_secs !== undefined ? row.level_remaining_secs : prev.levelRemainingSecs,
    breakTotalSecs:
      row.break_total_secs !== undefined ? row.break_total_secs : prev.breakTotalSecs,
  };
}

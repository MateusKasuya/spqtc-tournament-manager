// Adapter do Relógio do torneio: ler, transicionar e gravar com guarda num
// lugar só para as ações do Relógio. Sem auth, sem revalidate; a transição é
// do núcleo puro (`src/lib/tournament-clock.ts`).
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { clockStateColumns, getClockLevels, getTournamentRequiringStatus } from "@/db/queries/tournaments";
import { STATUS_RULES } from "@/lib/tournament-status";
import type { ClockChangeResult, ClockLevel, ClockResult, ClockState } from "@/lib/tournament-clock";

export const CLOCK_CONFLICT_ERROR = "A mesa mudou, recarregue e tente de novo";

export type ClockTransition = (state: ClockState, levels: ClockLevel[], now: Date) => ClockChangeResult;

interface ClockTransitionOptions {
  // "ignore": conflito vira sucesso silencioso, sem gravar (Fim do nível, ADR 0002).
  onConflict?: "refuse" | "ignore";
  // Condição extra na guarda do update, além do Relógio inteiro lido.
  guard?: SQL;
}

// Transição que sempre muda o Relógio (Iniciar, Pausar, Avançar, Voltar).
export function alwaysChanges(result: ClockResult): ClockChangeResult {
  return result.ok ? { ...result, changed: true } : result;
}

const CLOCK_KEYS = Object.keys(clockStateColumns) as (keyof ClockState)[];

function pickClockState(row: ClockState): ClockState {
  return Object.fromEntries(CLOCK_KEYS.map((key) => [key, row[key]])) as unknown as ClockState;
}

// Guarda de update das transições do Relógio: casa só se as sete colunas ainda
// valem o que foi lido. Todas, porque transições diferentes mudam colunas
// diferentes (pausar não mexe no Nível, avançar não mexe em "correndo").
// timerStartedAt compara em milissegundos: é o que sobrevive à leitura em Date.
function clockStateUnchanged(tournamentId: number, read: ClockState) {
  const guards = CLOCK_KEYS.map((key) => {
    const column = clockStateColumns[key];
    const value = read[key];
    if (value === null) return isNull(column);
    if (value instanceof Date) {
      return sql`date_trunc('milliseconds', ${column}) = ${value.toISOString()}::timestamptz`;
    }
    return eq(column, value);
  });
  return and(eq(tournaments.id, tournamentId), ...guards);
}

// Carrega o torneio (só Rodando) com o Relógio e os Níveis, aplica a transição
// e grava o Relógio inteiro só se nada mudou desde a leitura. `changed` diz se
// algo foi gravado.
export async function applyClockTransition(
  tournamentId: number,
  transition: ClockTransition,
  options: ClockTransitionOptions = {}
): Promise<{ changed: boolean } | { error: string }> {
  const loaded = await getTournamentRequiringStatus(tournamentId, STATUS_RULES.live);
  if ("error" in loaded) return loaded;
  const read = pickClockState(loaded.tournament);

  const levels = await getClockLevels(tournamentId);
  const result = transition(read, levels, new Date());
  if (!result.ok) return { error: result.error };
  if (!result.changed) return { changed: false };

  const updated = await db
    .update(tournaments)
    .set({ ...pickClockState(result.state), updatedAt: new Date() })
    .where(and(clockStateUnchanged(tournamentId, read), options.guard))
    .returning({ id: tournaments.id });

  if (updated.length > 0) return { changed: true };
  return options.onConflict === "ignore" ? { changed: false } : { error: CLOCK_CONFLICT_ERROR };
}

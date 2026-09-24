import { db } from "@/db";
import { tournaments, seasons, blindStructures, prizeStructures } from "@/db/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import type { ClockState } from "@/lib/tournament-clock";
import { MESA_CONFIG_COLUMNS, type MesaConfigKey } from "@/lib/mesa-snapshot";

export async function getTournaments() {
  return db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      date: tournaments.date,
      status: tournaments.status,
      buyInAmount: tournaments.buyInAmount,
      seasonId: tournaments.seasonId,
      seasonName: seasons.name,
    })
    .from(tournaments)
    .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .orderBy(desc(tournaments.date));
}

export async function getTournamentsBySeasonId(seasonId: number) {
  return db
    .select()
    .from(tournaments)
    .where(eq(tournaments.seasonId, seasonId))
    .orderBy(desc(tournaments.date));
}

export async function getTournamentById(id: number) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id));
  return tournament ?? null;
}

// Projeção das sete colunas do Relógio do torneio: o `ClockState` do núcleo
// mapeia um-para-um nelas. Única declaração do shape no lado do banco.
export const clockStateColumns = {
  currentBlindLevel: tournaments.currentBlindLevel,
  timerRunning: tournaments.timerRunning,
  timerRemainingSecs: tournaments.timerRemainingSecs,
  timerStartedAt: tournaments.timerStartedAt,
  breakActive: tournaments.breakActive,
  levelRemainingSecs: tournaments.levelRemainingSecs,
  breakTotalSecs: tournaments.breakTotalSecs,
} as const;

// Guarda de update das transições do Relógio: casa só se as sete colunas ainda
// valem o que a action leu. Todas, porque transições diferentes mudam colunas
// diferentes (pausar não mexe no Nível, avançar não mexe em "correndo").
// timerStartedAt compara em milissegundos: é o que sobrevive à leitura em Date.
export function clockStateUnchanged(tournamentId: number, read: ClockState) {
  const guards = (Object.keys(clockStateColumns) as (keyof ClockState)[]).map((key) => {
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

// Projeção da configuração do torneio que a mesa ao vivo usa, derivada de
// `MESA_CONFIG_COLUMNS` (o realtime aplica as mesmas colunas). O Relógio fica
// em `clockStateColumns`.
export const mesaTournamentColumns = {
  id: tournaments.id,
  ...(Object.fromEntries(
    (Object.keys(MESA_CONFIG_COLUMNS) as MesaConfigKey[]).map((key) => [key, tournaments[key]])
  ) as { [K in MesaConfigKey]: (typeof tournaments)[K] }),
};

export async function getMesaTournament(tournamentId: number) {
  const [tournament] = await db
    .select({ ...mesaTournamentColumns, ...clockStateColumns })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  return tournament ?? null;
}

export const mesaLevelColumns = {
  level: blindStructures.level,
  smallBlind: blindStructures.smallBlind,
  bigBlind: blindStructures.bigBlind,
  ante: blindStructures.ante,
  durationMinutes: blindStructures.durationMinutes,
  isBreak: blindStructures.isBreak,
  isAddonLevel: blindStructures.isAddonLevel,
  isBigAnte: blindStructures.isBigAnte,
} as const;

export async function getMesaLevels(tournamentId: number) {
  return db
    .select(mesaLevelColumns)
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);
}

// Níveis como o núcleo do Relógio os recebe (`ClockLevel`).
export async function getClockLevels(tournamentId: number) {
  return db
    .select({ level: blindStructures.level, durationMinutes: blindStructures.durationMinutes, isBreak: blindStructures.isBreak })
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId));
}

export async function getBlindStructure(tournamentId: number) {
  return db
    .select()
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);
}

export async function getPrizeStructure(tournamentId: number) {
  return db
    .select()
    .from(prizeStructures)
    .where(eq(prizeStructures.tournamentId, tournamentId))
    .orderBy(prizeStructures.position);
}


import { db } from "@/db";
import { tournaments, seasons, blindStructures, prizeStructures, tournamentResults } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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

export async function getTournamentResults(tournamentId: number) {
  return db
    .select()
    .from(tournamentResults)
    .where(eq(tournamentResults.tournamentId, tournamentId))
    .orderBy(tournamentResults.position);
}

import { db } from "@/db";
import { participants, players, tournaments } from "@/db/schema";
import { eq, and, sum, count, desc, sql, isNotNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const getSeasonRanking = unstable_cache(
  async (seasonId: number) => {
    return db
      .select({
        playerId: participants.playerId,
        playerName: players.name,
        playerNickname: players.nickname,
        totalPoints: sum(participants.pointsEarned).as("total_points"),
        tournamentsPlayed: count(participants.id).as("tournaments_played"),
        bestPosition: sql<number>`MIN(${participants.finishPosition})`.as("best_position"),
        wins: sql<number>`COUNT(CASE WHEN ${participants.finishPosition} = 1 THEN 1 END)`.as("wins"),
      })
      .from(participants)
      .innerJoin(players, eq(participants.playerId, players.id))
      .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
      .where(
        and(
          eq(tournaments.seasonId, seasonId),
          eq(tournaments.status, "finished"),
          isNotNull(participants.finishPosition)
        )
      )
      .groupBy(participants.playerId, players.name, players.nickname)
      .orderBy(desc(sql`total_points`));
  },
  ["season-ranking"],
  { revalidate: 60, tags: ["ranking"] }
);

export const getSeasonPointsByTournament = unstable_cache(
  async (seasonId: number) => {
    return db
      .select({
        playerId: participants.playerId,
        tournamentId: tournaments.id,
        finishPosition: participants.finishPosition,
        pointsEarned: participants.pointsEarned,
      })
      .from(participants)
      .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
      .where(
        and(
          eq(tournaments.seasonId, seasonId),
          eq(tournaments.status, "finished")
        )
      )
      .orderBy(tournaments.date);
  },
  ["season-points-by-tournament"],
  { revalidate: 60, tags: ["ranking"] }
);

export async function getPlayerStats(playerId: number) {
  const [stats] = await db
    .select({
      totalPoints: sum(participants.pointsEarned).as("total_points"),
      tournamentsPlayed: count(participants.id).as("tournaments_played"),
      bestPosition: sql<number>`MIN(${participants.finishPosition})`.as("best_position"),
      wins: sql<number>`COUNT(CASE WHEN ${participants.finishPosition} = 1 THEN 1 END)`.as("wins"),
      totalPrize: sum(participants.prizeAmount).as("total_prize"),
      totalRebuys: sum(participants.rebuyCount).as("total_rebuys"),
    })
    .from(participants)
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(participants.playerId, playerId),
        eq(tournaments.status, "finished"),
        isNotNull(participants.finishPosition)
      )
    );

  return stats ?? null;
}

export async function getPlayerSeasonHistory(playerId: number, seasonId: number) {
  return db
    .select({
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      tournamentDate: tournaments.date,
      buyInAmount: tournaments.buyInAmount,
      rebuyAmount: tournaments.rebuyAmount,
      addonAmount: tournaments.addonAmount,
      finishPosition: participants.finishPosition,
      pointsEarned: participants.pointsEarned,
      prizeAmount: participants.prizeAmount,
      rebuyCount: participants.rebuyCount,
      addonUsed: participants.addonUsed,
    })
    .from(participants)
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(participants.playerId, playerId),
        eq(tournaments.seasonId, seasonId),
        eq(tournaments.status, "finished")
      )
    )
    .orderBy(tournaments.date);
}

export async function getSeasonRankingFund(seasonId: number) {
  const rows = await db
    .select({
      rankingFeeAmount: tournaments.rankingFeeAmount,
      playersCount: sql<number>`COUNT(CASE WHEN ${participants.buyInPaid} = true THEN 1 END)`.as("players_count"),
    })
    .from(tournaments)
    .leftJoin(participants, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(tournaments.seasonId, seasonId),
        eq(tournaments.status, "finished")
      )
    )
    .groupBy(tournaments.id, tournaments.rankingFeeAmount);

  return rows.reduce((total, row) => total + row.rankingFeeAmount * Number(row.playersCount), 0);
}

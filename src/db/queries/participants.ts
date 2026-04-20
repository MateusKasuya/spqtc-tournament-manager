import { db } from "@/db";
import { participants, players } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function getParticipants(tournamentId: number) {
  return db
    .select({
      id: participants.id,
      tournamentId: participants.tournamentId,
      playerId: participants.playerId,
      name: players.name,
      nickname: players.nickname,
      buyInPaid: participants.buyInPaid,
      rebuyCount: participants.rebuyCount,
      addonUsed: participants.addonUsed,
      bonusChipUsed: participants.bonusChipUsed,
      finishPosition: participants.finishPosition,
      pointsEarned: participants.pointsEarned,
      prizeAmount: participants.prizeAmount,
      currentBounty: participants.currentBounty,
      eliminatedByIds: participants.eliminatedByIds,
      bountiesCollected: participants.bountiesCollected,
      eliminatedAt: participants.eliminatedAt,
      status: participants.status,
      createdAt: participants.createdAt,
    })
    .from(participants)
    .innerJoin(players, eq(participants.playerId, players.id))
    .where(eq(participants.tournamentId, tournamentId))
    .orderBy(participants.createdAt);
}

export async function getParticipantById(id: number) {
  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, id));
  return participant ?? null;
}

export async function getParticipantByPlayerAndTournament(playerId: number, tournamentId: number) {
  const [participant] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.playerId, playerId), eq(participants.tournamentId, tournamentId)));
  return participant ?? null;
}

export async function getPlayingCount(tournamentId: number) {
  const result = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.status, "playing")));
  return result.length;
}

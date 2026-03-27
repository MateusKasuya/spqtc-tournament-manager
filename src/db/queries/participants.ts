import { db } from "@/db";
import { participants, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function getParticipants(tournamentId: number) {
  return db
    .select({
      id: participants.id,
      tournamentId: participants.tournamentId,
      userId: participants.userId,
      name: users.name,
      nickname: users.nickname,
      buyInPaid: participants.buyInPaid,
      rebuyCount: participants.rebuyCount,
      addonUsed: participants.addonUsed,
      finishPosition: participants.finishPosition,
      pointsEarned: participants.pointsEarned,
      prizeAmount: participants.prizeAmount,
      eliminatedAt: participants.eliminatedAt,
      status: participants.status,
      createdAt: participants.createdAt,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
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

export async function getParticipantByUserAndTournament(userId: string, tournamentId: number) {
  const [participant] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.userId, userId), eq(participants.tournamentId, tournamentId)));
  return participant ?? null;
}

export async function getPlayingCount(tournamentId: number) {
  const result = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.status, "playing")));
  return result.length;
}

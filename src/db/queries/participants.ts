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
      addonCount: participants.addonCount,
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

// Projeção dos campos de participante que a mesa ao vivo usa. Única declaração
// do shape: os componentes da mesa recortam dela via `MesaSnapshot`.
export const mesaParticipantColumns = {
  id: participants.id,
  playerId: participants.playerId,
  name: players.name,
  nickname: players.nickname,
  status: participants.status,
  finishPosition: participants.finishPosition,
  buyInPaid: participants.buyInPaid,
  rebuyCount: participants.rebuyCount,
  addonCount: participants.addonCount,
  bonusChipUsed: participants.bonusChipUsed,
  currentBounty: participants.currentBounty,
  bountiesCollected: participants.bountiesCollected,
} as const;

export async function getMesaParticipants(tournamentId: number) {
  return db
    .select(mesaParticipantColumns)
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

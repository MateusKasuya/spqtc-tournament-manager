// Posições finais de uma distribuição de prêmios, na transação do chamador e
// depois do lock do torneio.
import { eq } from "drizzle-orm";
import { participants, type tournaments } from "@/db/schema";
import { finalPositionsAfterPayout } from "@/lib/payout-positions";
import type { LedgerExecutor } from "@/db/ledger/knockout-ledger";
import { writeRankingPoints, type ScoredParticipant } from "@/db/ledger/ranking-points";

// Grava só as posições que mudaram; em torneio Encerrado, recalcula os pontos
// de quem mudou. Devolve se alguma posição ou ponto do Ranking mudou.
export async function applyPayoutPositions(
  tx: LedgerExecutor,
  tournament: Pick<typeof tournaments.$inferSelect, "id" | "tournamentType" | "status">,
  payouts: { playerId: number; position: number }[]
) {
  const tournamentParticipants = await tx
    .select({
      id: participants.id,
      playerId: participants.playerId,
      status: participants.status,
      finishPosition: participants.finishPosition,
      eliminatedAt: participants.eliminatedAt,
    })
    .from(participants)
    .where(eq(participants.tournamentId, tournament.id));

  const positionById = finalPositionsAfterPayout(tournamentParticipants, payouts);
  const moved: ScoredParticipant[] = [];
  for (const p of tournamentParticipants) {
    const finishPosition = positionById.get(p.id) ?? null;
    if (finishPosition === p.finishPosition) continue;
    await tx.update(participants).set({ finishPosition }).where(eq(participants.id, p.id));
    moved.push({ id: p.id, playerId: p.playerId, finishPosition });
  }

  if (tournament.status !== "finished" || moved.length === 0) return { rankingChanged: false };
  await writeRankingPoints(tx, tournament, moved);
  return { rankingChanged: true };
}

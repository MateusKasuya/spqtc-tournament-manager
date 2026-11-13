// Posições finais de uma distribuição de prêmios, na transação do chamador e
// depois do lock do torneio.
import { eq } from "drizzle-orm";
import { participants, type tournaments } from "@/db/schema";
import { positionsAfterPayout } from "@/lib/payout-positions";
import type { LedgerExecutor } from "@/db/ledger/knockout-ledger";
import { writeRankingPoints, type ScoredParticipant } from "@/db/ledger/ranking-points";

// Grava só as posições que mudaram. Só em torneio Encerrado recalcula pontos de
// Ranking, e só de quem mudou de posição. `rankingChanged` diz se houve esse
// recálculo, isto é, se o Ranking precisa ser revalidado; com o torneio
// rodando é sempre false, mesmo que posições tenham mudado.
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
      dealPosition: participants.dealPosition,
      eliminatedAt: participants.eliminatedAt,
    })
    .from(participants)
    .where(eq(participants.tournamentId, tournament.id));

  // O Acordo novo substitui o anterior: quem sai dele perde a posição do Acordo.
  const positionById = positionsAfterPayout(tournamentParticipants, payouts);
  const moved: ScoredParticipant[] = [];
  for (const p of tournamentParticipants) {
    const { dealPosition, finishPosition } = positionById.get(p.id) ?? { dealPosition: null, finishPosition: null };
    if (dealPosition === p.dealPosition && finishPosition === p.finishPosition) continue;
    await tx.update(participants).set({ dealPosition, finishPosition }).where(eq(participants.id, p.id));
    if (finishPosition !== p.finishPosition) moved.push({ id: p.id, playerId: p.playerId, finishPosition });
  }

  if (tournament.status !== "finished" || moved.length === 0) return { rankingChanged: false };
  await writeRankingPoints(tx, tournament, moved);
  return { rankingChanged: true };
}

// Pontos de ranking gravados na transação do chamador: a regra do Encerrar,
// reusada pela redistribuição em torneio Encerrado para as duas não divergirem.
import { eq } from "drizzle-orm";
import { participants, type tournaments } from "@/db/schema";
import { rankingPoints } from "@/lib/points-table";
import { countKnockoutsByEliminator, type LedgerExecutor } from "@/db/ledger/knockout-ledger";

export type ScoredParticipant = Pick<typeof participants.$inferSelect, "id" | "playerId" | "finishPosition">;

export async function writeRankingPoints(
  tx: LedgerExecutor,
  tournament: Pick<typeof tournaments.$inferSelect, "id" | "tournamentType">,
  participantsToScore: ScoredParticipant[]
) {
  if (participantsToScore.length === 0) return;
  const knockoutsByPlayer =
    tournament.tournamentType === "bounty_builder"
      ? await countKnockoutsByEliminator(tx, tournament.id)
      : new Map<number, number>();
  for (const p of participantsToScore) {
    const points = rankingPoints(p.finishPosition, knockoutsByPlayer.get(p.playerId) ?? 0);
    await tx.update(participants).set({ pointsEarned: points.toFixed(2) }).where(eq(participants.id, p.id));
  }
}

// Pontos de ranking de um torneio, gravados na transação do chamador: a regra do
// Encerrar, reusada pela redistribuição de prêmios em torneio Encerrado para as
// duas nunca divergirem.
import { eq } from "drizzle-orm";
import { participants, type tournaments } from "@/db/schema";
import { computeParticipantPoints } from "@/lib/points-table";
import { countKnockoutsByEliminator, type LedgerExecutor } from "@/db/ledger/knockout-ledger";

// Grava os pontos de cada Participante passado pela Posição final dele e pelos
// Knockouts do Ledger (só em Bounty Builder); sem posição, zero.
export async function writeRankingPoints(
  tx: LedgerExecutor,
  tournament: Pick<typeof tournaments.$inferSelect, "id" | "tournamentType">,
  parts: { id: number; playerId: number; finishPosition: number | null }[]
) {
  if (parts.length === 0) return;
  const koByPlayer =
    tournament.tournamentType === "bounty_builder"
      ? await countKnockoutsByEliminator(tx, tournament.id)
      : new Map<number, number>();
  for (const p of parts) {
    const points = p.finishPosition ? computeParticipantPoints(p.finishPosition, koByPlayer.get(p.playerId) ?? 0) : 0;
    await tx.update(participants).set({ pointsEarned: points.toFixed(2) }).where(eq(participants.id, p.id));
  }
}

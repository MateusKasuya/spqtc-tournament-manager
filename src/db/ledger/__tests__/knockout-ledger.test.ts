import { describe, it, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { participants, transactions } from "@/db/schema";
import { applyKnockout, loadKnockoutSnapshot } from "@/db/ledger/knockout-ledger";
import { checkKnockout, type KnockoutEvent } from "@/lib/knockout-ledger";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";
import { testDb } from "@/test/db";

const BOUNTY_CONFIG = {
  tournamentType: "bounty_builder" as const,
  buyInAmount: 100,
  rankingFeeAmount: 20,
  bountyPercentage: 50,
};

describe("adapter do Ledger de Knockout", () => {
  it("estado alterado entre a precondição e a transação (dois admins) → rollback com 'A mesa mudou'", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const players = [await seedPlayer("P0"), await seedPlayer("P1"), await seedPlayer("P2")];
    const parts: number[] = [];
    for (const pl of players) {
      parts.push(await seedParticipant(t, pl, { status: "playing", buyInPaid: true, currentBounty: 40 }));
    }
    const event: KnockoutEvent = { kind: "elimination", victimId: parts[0], eliminatorPlayerIds: [players[1]] };

    // Admin A: precondição fora da transação passa.
    const outside = await loadKnockoutSnapshot(testDb, t);
    expect(outside && checkKnockout(outside, event)).toBeNull();

    // Admin B elimina o mesmo jogador antes de A entrar na transação.
    await testDb
      .update(participants)
      .set({ status: "eliminated", finishPosition: 3 })
      .where(eq(participants.id, parts[0]));

    await expect(
      testDb.transaction((tx) => applyKnockout(tx, t, event))
    ).rejects.toThrow("A mesa mudou, recarregue e tente de novo");

    // Nada foi gravado: sem linhas de bounty, Eliminador intacto, posição de B preservada.
    const rows = await testDb
      .select()
      .from(transactions)
      .where(and(eq(transactions.tournamentId, t), eq(transactions.type, "bounty_earned")));
    expect(rows).toHaveLength(0);
    const [e1] = await testDb.select().from(participants).where(eq(participants.id, parts[1]));
    expect(e1).toMatchObject({ currentBounty: 40, bountiesCollected: 0, status: "playing" });
    const [v] = await testDb.select().from(participants).where(eq(participants.id, parts[0]));
    expect(v.finishPosition).toBe(3);
  });
});

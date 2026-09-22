import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { transactions } from "@/db/schema";
import { confirmBuyIn, eliminatePlayer } from "@/actions/participants";
import { getParticipantById } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { seedTournament, seedPlayer, seedParticipant, seedPlayingParticipants } from "@/test/setup";
import { testDb } from "@/test/db";

const BOUNTY_CONFIG = {
  tournamentType: "bounty_builder" as const,
  buyInAmount: 100,
  rankingFeeAmount: 20,
  bountyPercentage: 50,
  rebuyAmount: 60,
};

// N jogadores em Bounty Builder, cada um com Bounty 40 após o buy-in.
async function setupBounty(t: number, n: number) {
  const players: number[] = [];
  const parts: number[] = [];
  for (let i = 0; i < n; i++) {
    const pl = await seedPlayer(`P${i}`);
    const p = await seedParticipant(t, pl);
    await confirmBuyIn(p);
    players.push(pl);
    parts.push(p);
  }
  return { players, parts };
}

async function bountyRows(t: number) {
  return testDb
    .select()
    .from(transactions)
    .where(and(eq(transactions.tournamentId, t), eq(transactions.type, "bounty_earned")))
    .orderBy(transactions.id);
}

describe("Knockout (eliminação) via Ledger de Knockout", () => {
  it("Eliminador fora de jogo é recusado antes de tocar no banco", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await eliminatePlayer(parts[2], [players[1]]);

    const res = await eliminatePlayer(parts[0], [players[2]]);
    expect(res).toEqual({ error: "Eliminador nao esta em jogo" });
    expect((await getParticipantById(parts[0]))?.status).toBe("playing");
    expect(await bountyRows(t)).toHaveLength(1);

    const stranger = await seedPlayer("fora");
    expect(await eliminatePlayer(parts[0], [stranger])).toEqual({ error: "Eliminador nao esta em jogo" });
  });

  it("Vítima na própria lista de Eliminadores é recusada", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    const res = await eliminatePlayer(parts[0], [players[0], players[1]]);
    expect(res).toEqual({ error: "Jogador nao pode eliminar a si mesmo" });
    expect((await getParticipantById(parts[0]))?.status).toBe("playing");
    expect((await getParticipantById(parts[1]))?.currentBounty).toBe(40);
  });

  it("Coroação com Bounty zero grava a linha de autocoleta com valor zero", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const p0 = await seedPlayer("P0");
    const p1 = await seedPlayer("P1");
    const v = await seedParticipant(t, p0, { status: "playing", buyInPaid: true, currentBounty: 0 });
    const champ = await seedParticipant(t, p1, { status: "playing", buyInPaid: true, currentBounty: 0 });

    expect(await eliminatePlayer(v, [p1])).not.toHaveProperty("error");

    const rows = await bountyRows(t);
    expect(rows.map((r) => [r.playerId, r.amount, r.bountyChange, r.relatedParticipantId])).toEqual([
      [p1, 0, 0, v],
      [p1, 0, 0, champ],
    ]);
    expect(await getParticipantById(champ)).toMatchObject({ status: "finished", finishPosition: 1, bountiesCollected: 0 });
  });

  it("torneio normal coroa o campeão sem linhas de bounty", async () => {
    const t = await seedTournament();
    const [p0, p1] = await seedPlayingParticipants(t, 2);
    expect(await eliminatePlayer(p0)).not.toHaveProperty("error");
    expect(await getParticipantById(p1)).toMatchObject({ status: "finished", finishPosition: 1 });
    expect(await bountyRows(t)).toHaveLength(0);
    expect((await getTournamentFinancialSummary(t)).bounty_earned).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  confirmBuyIn,
  addRebuy,
  addAddon,
  eliminatePlayer,
  undoElimination,
  distributePayouts,
} from "@/actions/participants";
import { getParticipantByPlayerAndTournament } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";
import { eq } from "drizzle-orm";
import { testDb } from "@/test/db";
import { tournaments } from "@/db/schema";

type TournamentOverrides = Partial<typeof tournaments.$inferInsert>;

// Buy-in confirmado de n jogadores pelas actions reais; retorna playerIds e participantIds.
async function setupPlayers(t: number, n: number) {
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

const NORMAL: TournamentOverrides = {
  status: "running",
  buyInAmount: 100,
  rankingFeeAmount: 10,
  rebuyAmount: 100,
  allowAddon: true,
  addonAmount: 50,
};

// Arrecadado 300 + 100 + 50 = 450; Fundo de ranking 3 × 10 = 30 → Prize pool 420.
// Montado Rodando (buy-in, Rebuy e add-on exigem) e só então levado ao status pedido.
async function setupNormal({ status, ...overrides }: TournamentOverrides = {}) {
  const t = await seedTournament({ ...NORMAL, ...overrides });
  const { players, parts } = await setupPlayers(t, 3);
  await addRebuy(parts[0]);
  await addAddon(parts[1]);
  if (status) await testDb.update(tournaments).set({ status }).where(eq(tournaments.id, t));
  return { t, players };
}

const BOUNTY: TournamentOverrides = {
  status: "running",
  tournamentType: "bounty_builder",
  buyInAmount: 100,
  rankingFeeAmount: 20,
  bountyPercentage: 50,
  rebuyAmount: 60,
};

// Arrecadado 300 + 60 = 360; Fundo de ranking 3 × 20 = 60;
// Bounty armado 3 × 40 + 30 do Rebuy = 150 → Prize pool 150, invariante a Knockout.
async function setupBounty() {
  const t = await seedTournament(BOUNTY);
  const { players, parts } = await setupPlayers(t, 3);
  await addRebuy(parts[0], [players[1]]);
  await eliminatePlayer(parts[0], [players[2]]);
  return { t, players, parts };
}

describe("distributePayouts contra o Prize pool", () => {
  it("soma dos Premios acima do Prize pool retorna erro e nao grava nada", async () => {
    const { t, players } = await setupNormal();
    const res = await distributePayouts(t, [
      { playerId: players[0], amount: 300, position: 1 },
      { playerId: players[1], amount: 121, position: 2 },
    ]);
    expect(res).toHaveProperty("error");
    expect((res as { error: string }).error).toMatch(/Prize pool/);
    expect((await getTournamentFinancialSummary(t)).prize).toBe(0);
    expect((await getParticipantByPlayerAndTournament(players[0], t))?.prizeAmount).toBe(0);
  });

  it("recusa acima do Prize pool nao apaga a distribuicao anterior", async () => {
    const { t, players } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 200, position: 1 }]);
    const res = await distributePayouts(t, [{ playerId: players[0], amount: 421, position: 1 }]);
    expect(res).toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).prize).toBe(200);
  });

  it("soma igual ao Prize pool (Rebuy e add-on fora do Fundo de ranking) e aceita", async () => {
    const { t, players } = await setupNormal();
    const res = await distributePayouts(t, [
      { playerId: players[0], amount: 300, position: 1 },
      { playerId: players[1], amount: 120, position: 2 },
    ]);
    expect(res).not.toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).prize).toBe(420);
  });

  it("soma menor que o Prize pool e aceita", async () => {
    const { t, players } = await setupNormal();
    const res = await distributePayouts(t, [{ playerId: players[0], amount: 200, position: 1 }]);
    expect(res).not.toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).prize).toBe(200);
  });

  it("participante sem buy-in confirmado nao reduz o Prize pool", async () => {
    const { t, players } = await setupNormal();
    await seedParticipant(t, await seedPlayer("sem buy-in"));
    const res = await distributePayouts(t, [{ playerId: players[0], amount: 420, position: 1 }]);
    expect(res).not.toHaveProperty("error");
  });

  it("Bounty Builder desconta o Bounty armado do Prize pool", async () => {
    const { t, players } = await setupBounty();
    const over = await distributePayouts(t, [{ playerId: players[1], amount: 151, position: 1 }]);
    expect(over).toHaveProperty("error");
    const exact = await distributePayouts(t, [{ playerId: players[1], amount: 150, position: 1 }]);
    expect(exact).not.toHaveProperty("error");
  });

  it("Bounty Builder: Prize pool nao muda depois de Desfazer", async () => {
    const { t, players, parts } = await setupBounty();
    await undoElimination(parts[0]);
    const over = await distributePayouts(t, [{ playerId: players[1], amount: 151, position: 1 }]);
    expect(over).toHaveProperty("error");
    const exact = await distributePayouts(t, [{ playerId: players[1], amount: 150, position: 1 }]);
    expect(exact).not.toHaveProperty("error");
  });
});

describe("distributePayouts e o Status do torneio", () => {
  it.each(["pending", "cancelled"] as const)("torneio %s retorna erro e nao grava nada", async (status) => {
    const { t, players } = await setupNormal({ status });
    const res = await distributePayouts(t, [{ playerId: players[0], amount: 100, position: 1 }]);
    expect(res).toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).prize).toBe(0);
  });

  it.each(["running", "finished"] as const)("torneio %s aceita", async (status) => {
    const { t, players } = await setupNormal({ status });
    const res = await distributePayouts(t, [{ playerId: players[0], amount: 100, position: 1 }]);
    expect(res).not.toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).prize).toBe(100);
  });

  it("torneio inexistente retorna erro", async () => {
    const res = await distributePayouts(999999, []);
    expect(res).toHaveProperty("error");
  });
});

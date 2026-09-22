import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { participants, transactions } from "@/db/schema";
import { confirmBuyIn, eliminatePlayer, undoElimination, addRebuy, addDoubleRebuy, undoRebuy } from "@/actions/participants";
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

describe("Desfazer eliminação via Ledger de Knockout", () => {
  it("recusa Desfazer com dependência posterior; aceita depois de desfazer o posterior", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 4);
    await eliminatePlayer(parts[0], [players[1]]); // P1 coleta 20, Bounty 60
    await eliminatePlayer(parts[1], [players[2]]); // P2 coleta 30, Bounty 70

    expect(await undoElimination(parts[0])).toEqual({ error: "Desfaca primeiro as eliminacoes posteriores" });
    expect(await getParticipantById(parts[0])).toMatchObject({ status: "eliminated", finishPosition: 4 });
    expect(await bountyRows(t)).toHaveLength(2);

    expect(await undoElimination(parts[1])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[1])).toMatchObject({ status: "playing", currentBounty: 60, bountiesCollected: 20 });
    expect(await getParticipantById(parts[2])).toMatchObject({ currentBounty: 40, bountiesCollected: 0 });

    expect(await undoElimination(parts[0])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[0])).toMatchObject({ status: "playing", finishPosition: null, currentBounty: 40, eliminatedByIds: [] });
    expect(await getParticipantById(parts[1])).toMatchObject({ currentBounty: 40, bountiesCollected: 0 });
    expect(await bountyRows(t)).toHaveLength(0);
  });

  it("Coroação com Bounty zero desfeita: apaga a linha zero e não apaga prêmio antigo do campeão", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await eliminatePlayer(parts[0], [players[2]]); // P2 coleta 20 → Bounty 60
    // Cenário alvo: campeão com Bounty zero na Coroação. Zera o Bounty de P1 direto
    // no banco; P1 então elimina P2 (recebe 30 em dinheiro e 30 de Bounty) e é
    // coroado coletando os 30 de Bounty que acabou de receber.
    await testDb.update(participants).set({ currentBounty: 0 }).where(eq(participants.id, parts[1]));
    await eliminatePlayer(parts[2], [players[1]]);

    const before = await getParticipantById(parts[1]);
    expect(before).toMatchObject({ status: "finished", currentBounty: 0, bountiesCollected: 60 });
    const rowsBefore = await bountyRows(t);
    expect(rowsBefore.at(-1)).toMatchObject({ playerId: players[1], relatedParticipantId: parts[1], amount: 30, bountyChange: 0 });

    expect(await undoElimination(parts[2])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[1])).toMatchObject({ status: "playing", finishPosition: null, currentBounty: 0, bountiesCollected: 0 });
    expect(await getParticipantById(parts[2])).toMatchObject({ status: "playing", currentBounty: 60, bountiesCollected: 20 });
    expect(await bountyRows(t)).toHaveLength(1);
  });

  it("Coroação com Bounty zero (linha zero) e Desfazer no campeão só descoroa", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const p0 = await seedPlayer("P0");
    const p1 = await seedPlayer("P1");
    const v = await seedParticipant(t, p0, { status: "playing", buyInPaid: true, currentBounty: 0, bountiesCollected: 50 });
    const champ = await seedParticipant(t, p1, { status: "playing", buyInPaid: true, currentBounty: 0, bountiesCollected: 80 });
    await eliminatePlayer(v, [p1]);
    expect(await bountyRows(t)).toHaveLength(2);

    expect(await undoElimination(champ)).not.toHaveProperty("error");
    expect(await getParticipantById(champ)).toMatchObject({ status: "playing", finishPosition: null, currentBounty: 0, bountiesCollected: 80 });
    expect(await getParticipantById(v)).toMatchObject({ status: "eliminated", finishPosition: 2, bountiesCollected: 50 });
    expect(await bountyRows(t)).toHaveLength(1);
  });

  it("Desfazer no campeão devolve o Bounty coletado na Coroação sem tocar na última Vítima", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 2);
    await eliminatePlayer(parts[0], [players[1]]);
    expect(await getParticipantById(parts[1])).toMatchObject({ status: "finished", currentBounty: 0, bountiesCollected: 80 });

    expect(await undoElimination(parts[1])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[1])).toMatchObject({ status: "playing", finishPosition: null, currentBounty: 60, bountiesCollected: 20 });
    expect(await getParticipantById(parts[0])).toMatchObject({ status: "eliminated", finishPosition: 2, currentBounty: 0 });
    expect((await getTournamentFinancialSummary(t)).bounty_earned).toBe(20);
  });

  it("lista de Eliminadores volta à do Knockout anterior após Desfazer", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 4);
    await addRebuy(parts[0], [players[1]]);
    expect((await getParticipantById(parts[0]))?.eliminatedByIds).toEqual([players[1]]);
    await eliminatePlayer(parts[0], [players[2], players[3]]);
    expect((await getParticipantById(parts[0]))?.eliminatedByIds).toEqual([players[2], players[3]]);

    await undoElimination(parts[0]);
    expect((await getParticipantById(parts[0]))?.eliminatedByIds).toEqual([players[1]]);
  });
});

describe("Rebuy via Ledger de Knockout", () => {
  it("rebuy duplo grava duas linhas de rebuy e um único Knockout", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    expect(await addDoubleRebuy(parts[0], [players[1]])).not.toHaveProperty("error");

    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 2, currentBounty: 30, eliminatedByIds: [players[1]] });
    expect(await getParticipantById(parts[1])).toMatchObject({ currentBounty: 60, bountiesCollected: 20 });
    const rows = await testDb.select().from(transactions).where(eq(transactions.tournamentId, t)).orderBy(transactions.id);
    const rebuys = rows.filter((r) => r.type === "rebuy");
    const bounties = rows.filter((r) => r.type === "bounty_earned");
    expect(rebuys).toHaveLength(2);
    expect(bounties).toHaveLength(1);
    const stamps = new Set([...rebuys, ...bounties].map((r) => r.createdAt.toISOString()));
    expect(stamps.size).toBe(1);
  });

  it("torneio normal: rebuy incrementa o contador sem linhas de bounty", async () => {
    const t = await seedTournament({ rebuyAmount: 50 });
    const [p0] = await seedPlayingParticipants(t, 2);
    expect(await addRebuy(p0)).not.toHaveProperty("error");
    expect(await addDoubleRebuy(p0)).not.toHaveProperty("error");
    expect(await getParticipantById(p0)).toMatchObject({ rebuyCount: 3, currentBounty: 0 });
    expect(await bountyRows(t)).toHaveLength(0);
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(150);
  });

  it("recusas de Eliminador fora de jogo e Vítima na própria lista valem para rebuy", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await eliminatePlayer(parts[2], [players[1]]);
    expect(await addRebuy(parts[0], [players[2]])).toEqual({ error: "Eliminador nao esta em jogo" });
    expect(await addDoubleRebuy(parts[0], [players[0]])).toEqual({ error: "Jogador nao pode eliminar a si mesmo" });
    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 0, currentBounty: 40 });
  });
});

describe("Desfazer rebuy via Ledger de Knockout", () => {
  it("Desfazer rebuy que não gerou linhas de bounty (legado) tira o Bounty do rebuy", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 2);
    await testDb.update(participants).set({ rebuyCount: 1, currentBounty: 30 }).where(eq(participants.id, parts[0]));
    await testDb.insert(transactions).values({ tournamentId: t, playerId: players[0], type: "rebuy", amount: 60 });

    expect(await undoRebuy(parts[0])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 0, currentBounty: 0 });
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(0);
  });

  it("Desfazer rebuy após a Vítima acumular como Eliminadora preserva o acúmulo (delta, não absoluto)", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await addRebuy(parts[0], [players[1]]); // P1 coleta 20 → 60; P0 Bounty novo 30
    await eliminatePlayer(parts[2], [players[0]]); // P0 coleta 20 → Bounty 50

    expect(await undoRebuy(parts[0])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 0, currentBounty: 60, bountiesCollected: 20 });
    expect(await getParticipantById(parts[1])).toMatchObject({ currentBounty: 40, bountiesCollected: 0 });
    expect((await getTournamentFinancialSummary(t)).bounty_earned).toBe(20);
  });

  it("rebuy duplo desfeito em dois toques", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await addDoubleRebuy(parts[0], [players[1]]);

    expect(await undoRebuy(parts[0])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 1, currentBounty: 30 });
    expect(await getParticipantById(parts[1])).toMatchObject({ currentBounty: 60, bountiesCollected: 20 });
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(60);

    expect(await undoRebuy(parts[0])).not.toHaveProperty("error");
    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 0, currentBounty: 40, eliminatedByIds: [] });
    expect(await getParticipantById(parts[1])).toMatchObject({ currentBounty: 40, bountiesCollected: 0 });
    expect(await getTournamentFinancialSummary(t)).toMatchObject({ rebuy: 0, bounty_earned: 0 });

    expect(await undoRebuy(parts[0])).toEqual({ error: "Nenhum rebuy para desfazer" });
  });

  it("recusa Desfazer rebuy com dependência posterior", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await addRebuy(parts[0], [players[1]]);
    await eliminatePlayer(parts[1], [players[2]]);

    expect(await undoRebuy(parts[0])).toEqual({ error: "Desfaca primeiro as eliminacoes posteriores" });
    expect(await getParticipantById(parts[0])).toMatchObject({ rebuyCount: 1, currentBounty: 30 });
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(60);
  });
});

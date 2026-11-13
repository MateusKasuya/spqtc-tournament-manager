import { describe, it, expect } from "vitest";
import {
  confirmBuyIn,
  addRebuy,
  addAddon,
  eliminatePlayer,
  undoElimination,
  undoBuyIn,
  undoRebuy,
  undoAddon,
  distributePayouts,
  removeParticipant,
} from "@/actions/participants";
import { getParticipantByPlayerAndTournament } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { getMesaLiveData } from "@/actions/mesa";
import { updateTournamentStatus } from "@/actions/tournaments";
import { getPlayerStats } from "@/db/queries/ranking";
import { loadPrizePool } from "@/db/ledger/saldo";
import { computeSaldo } from "@/lib/prize-pool";
import { derivePrizesPaid } from "@/lib/mesa-panels/prizes-paid";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { loadMesaSnapshot } from "@/db/queries/mesa";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";
import { and, eq, sql } from "drizzle-orm";
import { testDb } from "@/test/db";
import { tournaments, transactions } from "@/db/schema";

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
  return { t, players, parts };
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

// Prize pool 420 (setupNormal): Rebuy de 100 no P0 e add-on de 50 no P1.
// Desfazer um Rebuy tira 100 do Prize pool; um add-on, 50; um buy-in, 100 menos a taxa de 10.
describe("Desfazer e o Saldo", () => {
  it("undoRebuy que deixaria o Saldo negativo e recusado e nao muda nada", async () => {
    const { t, players, parts } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 400, position: 1 }]);
    const res = await undoRebuy(parts[0]);
    expect(res).toHaveProperty("error");
    expect((res as { error: string }).error).toMatch(/Saldo negativo.*Refaca a distribuicao de premios/);
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(100);
    expect((await getParticipantByPlayerAndTournament(players[0], t))?.rebuyCount).toBe(1);
  });

  it("undoRebuy que deixa o Saldo em zero e aceito", async () => {
    const { t, players, parts } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 320, position: 1 }]);
    const res = await undoRebuy(parts[0]);
    expect(res).not.toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(0);
  });

  it("undoAddon que deixaria o Saldo negativo e recusado e nao muda nada", async () => {
    const { t, players, parts } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 400, position: 1 }]);
    const res = await undoAddon(parts[1]);
    expect(res).toHaveProperty("error");
    expect((res as { error: string }).error).toMatch(/Saldo negativo.*Refaca a distribuicao de premios/);
    expect((await getTournamentFinancialSummary(t)).addon).toBe(50);
    expect((await getParticipantByPlayerAndTournament(players[1], t))?.addonCount).toBe(1);
  });

  it("undoAddon que deixa o Saldo em zero e aceito", async () => {
    const { t, players, parts } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 370, position: 1 }]);
    const res = await undoAddon(parts[1]);
    expect(res).not.toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).addon).toBe(0);
  });

  it("undoBuyIn que deixaria o Saldo negativo e recusado e nao muda nada", async () => {
    const { t, players, parts } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 400, position: 1 }]);
    const res = await undoBuyIn(parts[2]);
    expect(res).toHaveProperty("error");
    expect((res as { error: string }).error).toMatch(/Saldo negativo.*Refaca a distribuicao de premios/);
    expect((await getTournamentFinancialSummary(t)).buy_in).toBe(300);
    expect((await getParticipantByPlayerAndTournament(players[2], t))?.buyInPaid).toBe(true);
  });

  it("undoBuyIn que deixa o Saldo em zero e aceito", async () => {
    const { t, players, parts } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 330, position: 1 }]);
    const res = await undoBuyIn(parts[2]);
    expect(res).not.toHaveProperty("error");
    expect((await getTournamentFinancialSummary(t)).buy_in).toBe(200);
  });
});

// Só recebe Prêmio quem tem buy-in confirmado (Em jogo ou eliminado); um item
// para quem não está inscrito ou ainda aguarda buy-in recusa a distribuição inteira.
describe("distributePayouts e o buy-in confirmado", () => {
  async function prizeRows(t: number) {
    return testDb
      .select()
      .from(transactions)
      .where(and(eq(transactions.tournamentId, t), eq(transactions.type, "prize")));
  }

  it("Jogador Aguardando buy-in recusa a distribuicao e nao grava nada de ninguem", async () => {
    const { t, players } = await setupNormal();
    const waiting = await seedPlayer("aguardando");
    await seedParticipant(t, waiting);

    const res = await distributePayouts(t, [
      { playerId: players[0], amount: 50, position: 1 },
      { playerId: waiting, amount: 100, position: 2 },
    ]);

    expect(res).toEqual({ error: "So recebe Premio quem tem buy-in confirmado" });
    expect(await prizeRows(t)).toHaveLength(0);
    for (const playerId of [players[0], waiting]) {
      const row = await getParticipantByPlayerAndTournament(playerId, t);
      expect(row?.prizeAmount).toBe(0);
      expect(row?.finishPosition).toBeNull();
    }
  });

  it("Jogador nao inscrito recusa a distribuicao em vez de ser descartado em silencio", async () => {
    const { t, players } = await setupNormal();
    const outsider = await seedPlayer("de fora");

    const res = await distributePayouts(t, [
      { playerId: players[0], amount: 50, position: 1 },
      { playerId: outsider, amount: 100, position: 2 },
    ]);

    expect(res).toEqual({ error: "Jogador nao inscrito neste torneio" });
    expect(await prizeRows(t)).toHaveLength(0);
    expect((await getParticipantByPlayerAndTournament(players[0], t))?.prizeAmount).toBe(0);
  });

  it("recusa nao apaga a distribuicao anterior", async () => {
    const { t, players } = await setupNormal();
    const waiting = await seedPlayer("aguardando");
    await seedParticipant(t, waiting);
    expect(await distributePayouts(t, [{ playerId: players[0], amount: 200, position: 1 }])).toEqual({ success: true });

    const res = await distributePayouts(t, [{ playerId: waiting, amount: 200, position: 1 }]);

    expect(res).toHaveProperty("error");
    expect((await prizeRows(t)).map((r) => [r.playerId, r.amount])).toEqual([[players[0], 200]]);
  });

  it("paga quem tem buy-in confirmado, Em jogo ou eliminado, e a redistribuicao substitui a anterior", async () => {
    const { t, players, parts } = await setupNormal();
    expect(await eliminatePlayer(parts[2])).toEqual({ success: true });

    expect(
      await distributePayouts(t, [
        { playerId: players[0], amount: 200, position: 1 },
        { playerId: players[2], amount: 100, position: 3 },
      ])
    ).toEqual({ success: true });
    expect(await distributePayouts(t, [{ playerId: players[2], amount: 150, position: 3 }])).toEqual({ success: true });

    expect((await prizeRows(t)).map((r) => [r.playerId, r.amount])).toEqual([[players[2], 150]]);
    const eliminated = await getParticipantByPlayerAndTournament(players[2], t);
    expect(eliminated?.prizeAmount).toBe(150);
    expect(eliminated?.finishPosition).toBe(3);
  });
});

// Prêmio pago só sai refazendo a distribuição: Desfazer o buy-in ou remover quem
// tem Prêmio é recusado, para nenhuma transação prize ficar sem Participante.
describe("Premio pago bloqueia Desfazer buy-in e Remover participante", () => {
  const PRIZE_PAID = "Participante tem Premio pago: refaca a distribuicao de premios sem ele antes";

  async function allRows(t: number) {
    return testDb.select().from(transactions).where(eq(transactions.tournamentId, t)).orderBy(transactions.id);
  }

  it("undoBuyIn de quem tem Premio pago (acordo com o torneio Rodando) e recusado e nao muda nada", async () => {
    const { t, players, parts } = await setupNormal();
    expect(await distributePayouts(t, [{ playerId: players[2], amount: 50, position: 1 }])).toEqual({ success: true });
    const before = await allRows(t);

    const res = await undoBuyIn(parts[2]);

    expect(res).toEqual({ error: PRIZE_PAID });
    expect(await allRows(t)).toEqual(before);
    const row = await getParticipantByPlayerAndTournament(players[2], t);
    expect(row?.buyInPaid).toBe(true);
    expect(row?.status).toBe("playing");
  });

  it("undoBuyIn de quem saiu da redistribuicao volta a ser aceito", async () => {
    const { t, players, parts } = await setupNormal();
    expect(await distributePayouts(t, [{ playerId: players[2], amount: 50, position: 1 }])).toEqual({ success: true });
    expect(await distributePayouts(t, [{ playerId: players[0], amount: 50, position: 1 }])).toEqual({ success: true });

    expect(await undoBuyIn(parts[2])).toEqual({ success: true });
  });

  it("removeParticipant de quem tem Premio pago e recusado e nao apaga nada", async () => {
    const { t } = await setupNormal();
    const waiting = await seedPlayer("aguardando");
    const part = await seedParticipant(t, waiting);
    // Prêmio gravado antes do #123, quando a distribuição ainda pagava quem aguardava buy-in.
    await testDb.insert(transactions).values({ tournamentId: t, playerId: waiting, type: "prize", amount: 100 });
    const before = await allRows(t);

    const res = await removeParticipant(part);

    expect(res).toEqual({ error: PRIZE_PAID });
    expect(await getParticipantByPlayerAndTournament(waiting, t)).not.toBeNull();
    expect(await allRows(t)).toEqual(before);
  });

  it("removeParticipant de quem aguarda buy-in sem Premio continua funcionando", async () => {
    const { t, players } = await setupNormal();
    await distributePayouts(t, [{ playerId: players[0], amount: 50, position: 1 }]);
    const waiting = await seedPlayer("aguardando");
    const part = await seedParticipant(t, waiting);

    expect(await removeParticipant(part)).toEqual({ success: true });
    expect(await getParticipantByPlayerAndTournament(waiting, t)).toBeNull();
  });
});

// Cenário da triagem do #123: Rodando, A e B Em jogo (Prize pool 200) e C
// aguardando buy-in. Antes, C recebia Prêmio, era removido e o prize ficava
// órfão: a página somava 150 pagos e a mesa, 50.
describe("cenario do Premio orfao (#123)", () => {
  it("nao deixa prize sem Participante, e o Saldo da pagina bate com o da mesa", async () => {
    const t = await seedTournament({ status: "running", buyInAmount: 100, rankingFeeAmount: 0 });
    const { players } = await setupPlayers(t, 2);
    const c = await seedPlayer("C");
    const partC = await seedParticipant(t, c);

    expect(
      await distributePayouts(t, [
        { playerId: players[0], amount: 50, position: 1 },
        { playerId: c, amount: 100, position: 2 },
      ])
    ).toHaveProperty("error");
    expect(await removeParticipant(partC)).toEqual({ success: true });
    expect(await distributePayouts(t, [{ playerId: players[0], amount: 50, position: 1 }])).toEqual({ success: true });

    const page = await loadPrizePool(testDb, t);
    const mesa = derivePrizesPaid(await getMesaLiveData(t));
    expect(page.prizePool).toBe(200);
    expect(page.prizesPaid).toBe(50);
    expect(mesa?.total).toBe(50);
    expect(computeSaldo(page.prizePool, page.prizesPaid)).toBe(150);
  });
});

const ORPHAN_PRIZE_QUERY = `
SELECT p.id AS participant_id, p.tournament_id, tour.name AS tournament, tour.status AS tournament_status,
  p.player_id, pl.name AS player, p.prize_amount, COALESCE(SUM(t.amount), 0) AS premio_pago
FROM participants p
JOIN tournaments tour ON tour.id = p.tournament_id
JOIN players pl ON pl.id = p.player_id
LEFT JOIN transactions t ON t.tournament_id = p.tournament_id AND t.player_id = p.player_id AND t.type = 'prize'
GROUP BY p.id, tour.name, tour.status, pl.name
HAVING p.prize_amount <> COALESCE(SUM(t.amount), 0)
ORDER BY p.tournament_id, p.player_id;`;

const REPEATED_POSITION_QUERY = `
SELECT p.tournament_id, tour.name AS tournament, tour.status AS tournament_status, p.finish_position,
  string_agg(pl.name || ' (' || p.status || ', ' || p.points_earned || ' pts)', ', ' ORDER BY pl.name) AS participantes
FROM participants p
JOIN tournaments tour ON tour.id = p.tournament_id
JOIN players pl ON pl.id = p.player_id
WHERE p.finish_position IS NOT NULL
GROUP BY p.tournament_id, tour.name, tour.status, p.finish_position
HAVING COUNT(*) > 1
ORDER BY p.tournament_id, p.finish_position;`;

// Refazer a distribuição substitui o acordo inteiro: quem fica fora da lista nova
// perde o Prêmio e volta à Posição final que a mesa dá (#124).
describe("refazer a distribuicao tira Premio e posicao de quem sai do acordo (#124)", () => {
  // Prize pool 300 (3 buy-ins de 100, sem taxa).
  async function setupThree(overrides: TournamentOverrides = {}) {
    const t = await seedTournament({ status: "running", buyInAmount: 100, rankingFeeAmount: 0, ...overrides });
    const { players, parts } = await setupPlayers(t, 3);
    return { t, players, parts };
  }

  const participantOf = (playerId: number, t: number) => getParticipantByPlayerAndTournament(playerId, t);

  // As duas consultas de detecção do brief, como vão no corpo do PR. O banco
  // de teste é zerado a cada teste, então elas só enxergam o torneio do teste.
  async function detectionRows() {
    const orphanPrizes = await testDb.execute(sql.raw(ORPHAN_PRIZE_QUERY));
    const repeatedPositions = await testDb.execute(sql.raw(REPEATED_POSITION_QUERY));
    return { orphanPrizes: orphanPrizes.rows, repeatedPositions: repeatedPositions.rows };
  }

  it("quem sai da lista fica sem Premio, e getPlayerStats deixa de contar esse Premio", async () => {
    const { t, players } = await setupThree();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 2 },
    ]);

    expect(
      await distributePayouts(t, [
        { playerId: a, amount: 200, position: 1 },
        { playerId: c, amount: 100, position: 2 },
      ])
    ).toEqual({ success: true });

    expect((await participantOf(b, t))?.prizeAmount).toBe(0);
    expect((await participantOf(c, t))?.prizeAmount).toBe(100);
    expect((await participantOf(a, t))?.prizeAmount).toBe(200);
    await updateTournamentStatus(t, "finished");
    expect(Number((await getPlayerStats(b))?.totalPrize ?? 0)).toBe(0);
  });

  it("quem sai da lista Em jogo fica sem posicao, e o Encerrar nao lhe da pontos de posicao", async () => {
    const { t, players } = await setupThree();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 2 },
    ]);
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: c, amount: 100, position: 2 },
    ]);

    expect((await participantOf(b, t))?.finishPosition).toBeNull();
    expect(await updateTournamentStatus(t, "finished")).toEqual({ success: true });

    expect(Number((await participantOf(a, t))?.pointsEarned)).toBe(12);
    expect(Number((await participantOf(c, t))?.pointsEarned)).toBe(10);
    expect(Number((await participantOf(b, t))?.pointsEarned)).toBe(0);
    expect(await detectionRows()).toEqual({ orphanPrizes: [], repeatedPositions: [] });
  });

  it("quem sai da lista depois de cair volta a Posicao final da Eliminacao, mesmo com o acordo anterior fora da ordem", async () => {
    const t = await seedTournament({ status: "running", buyInAmount: 100, rankingFeeAmount: 0 });
    const { players, parts } = await setupPlayers(t, 4);
    const [a, b, d, e] = players;
    await eliminatePlayer(parts[3]); // E cai primeiro: 4º
    await eliminatePlayer(parts[2]); // D cai depois: 3º
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: e, amount: 100, position: 2 },
    ]);

    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 2 },
    ]);

    expect((await participantOf(e, t))?.finishPosition).toBe(4);
    expect((await participantOf(d, t))?.finishPosition).toBe(3);
    expect((await participantOf(e, t))?.prizeAmount).toBe(0);
    expect(await detectionRows()).toEqual({ orphanPrizes: [], repeatedPositions: [] });
  });

  it("quem saiu da lista depois de cair nao repete a posicao que o acordo deu a outro", async () => {
    const t = await seedTournament({ status: "running", buyInAmount: 100, rankingFeeAmount: 0 });
    const { players, parts } = await setupPlayers(t, 4);
    const [a, b, d, e] = players;
    await eliminatePlayer(parts[3]); // E: 4º
    await eliminatePlayer(parts[2]); // D: 3º
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: d, amount: 100, position: 3 },
    ]);

    // O acordo novo leva E ao 3º; D, fora dele, não pode ficar também em 3º.
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 2 },
      { playerId: e, amount: 50, position: 3 },
    ]);

    expect((await participantOf(e, t))?.finishPosition).toBe(3);
    expect((await participantOf(d, t))?.finishPosition).toBe(4);
    expect(await detectionRows()).toEqual({ orphanPrizes: [], repeatedPositions: [] });
  });

  it("redistribuir num torneio Encerrado recalcula os pontos de quem mudou de posicao", async () => {
    const { t, players } = await setupThree();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 2 },
      { playerId: c, amount: 0, position: 3 },
    ]);
    await updateTournamentStatus(t, "finished");
    expect(Number((await participantOf(c, t))?.pointsEarned)).toBe(8);

    expect(
      await distributePayouts(t, [
        { playerId: a, amount: 200, position: 1 },
        { playerId: c, amount: 100, position: 2 },
      ])
    ).toEqual({ success: true });

    expect(Number((await participantOf(a, t))?.pointsEarned)).toBe(12);
    expect(Number((await participantOf(c, t))?.pointsEarned)).toBe(10);
    expect(Number((await participantOf(b, t))?.pointsEarned)).toBe(0);
    expect(await detectionRows()).toEqual({ orphanPrizes: [], repeatedPositions: [] });
  });

  it("Campeao coroado perde o 1o quando o acordo novo da o 1o a outro, sem repetir posicao", async () => {
    const { t, players, parts } = await setupThree();
    const [a, b, c] = players;
    await eliminatePlayer(parts[2]); // C: 3º
    await eliminatePlayer(parts[1]); // B: 2º, e A é coroado
    expect((await participantOf(a, t))?.status).toBe("finished");
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 2 },
    ]);
    await updateTournamentStatus(t, "finished");
    expect(Number((await participantOf(a, t))?.pointsEarned)).toBe(12);

    await distributePayouts(t, [
      { playerId: b, amount: 200, position: 1 },
      { playerId: c, amount: 100, position: 2 },
    ]);

    expect((await participantOf(a, t))?.finishPosition).toBe(3);
    expect(Number((await participantOf(a, t))?.pointsEarned)).toBe(8);
    expect(Number((await participantOf(b, t))?.pointsEarned)).toBe(12);
    expect(Number((await participantOf(c, t))?.pointsEarned)).toBe(10);
    expect(await detectionRows()).toEqual({ orphanPrizes: [], repeatedPositions: [] });
  });

  it("quem caiu e sai da lista mantem posicao, mas getPlayerStats deixa de contar o Premio dele", async () => {
    const { t, players, parts } = await setupThree();
    const [a, b, c] = players;
    await eliminatePlayer(parts[1]); // B: 3º
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 100, position: 3 },
    ]);
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: c, amount: 100, position: 2 },
    ]);
    await updateTournamentStatus(t, "finished");

    const stats = await getPlayerStats(b);
    expect(stats?.bestPosition).toBe(3);
    expect(Number(stats?.totalPrize)).toBe(0);
  });

  it("Bounty Builder Encerrado: o recalculo conta os Knockouts do Ledger, como o Encerrar", async () => {
    const t = await seedTournament({
      status: "running",
      tournamentType: "bounty_builder",
      buyInAmount: 100,
      rankingFeeAmount: 0,
      bountyPercentage: 50,
    });
    const { players, parts } = await setupPlayers(t, 3);
    const [a, b, c] = players;
    await eliminatePlayer(parts[1], [c]); // B cai para C: 3º, e C ganha um Knockout
    await distributePayouts(t, [
      { playerId: a, amount: 100, position: 1 },
      { playerId: c, amount: 50, position: 2 },
    ]);
    await updateTournamentStatus(t, "finished");
    expect(Number((await participantOf(c, t))?.pointsEarned)).toBe(10.25);

    await distributePayouts(t, [
      { playerId: c, amount: 100, position: 1 },
      { playerId: a, amount: 50, position: 2 },
    ]);

    expect(Number((await participantOf(c, t))?.pointsEarned)).toBe(12.25);
    expect(Number((await participantOf(a, t))?.pointsEarned)).toBe(10);
    expect(Number((await participantOf(b, t))?.pointsEarned)).toBe(8);
  });
});

// O Acordo fixa a Posição final de quem está nele: o jogo continua depois dele,
// mas nenhum Knockout, Desfazer, Coroação ou buy-in tardio muda essas posições (#168).
describe("o Acordo fixa a Posicao final de quem esta nele (#168)", () => {
  const participantOf = (playerId: number, t: number) => getParticipantByPlayerAndTournament(playerId, t);

  async function positionsOf(t: number, players: number[]) {
    return Promise.all(players.map(async (pl) => (await participantOf(pl, t))?.finishPosition ?? null));
  }

  async function mesaChampion(t: number) {
    const snapshot = await loadMesaSnapshot(t);
    if (!snapshot) throw new Error("torneio nao encontrado");
    return buildMesaPanels({ snapshot, remainingSeconds: 0, isAdmin: true }).players.panel.champion?.name ?? null;
  }

  async function repeatedPositions() {
    return (await testDb.execute(sql.raw(REPEATED_POSITION_QUERY))).rows;
  }

  // Prize pool 400 (4 buy-ins de 100, sem taxa). D cai primeiro: 4º.
  async function setupFourAfterD() {
    const t = await seedTournament({ status: "running", buyInAmount: 100, rankingFeeAmount: 0 });
    const { players, parts } = await setupPlayers(t, 4);
    await eliminatePlayer(parts[3]);
    return { t, players, parts };
  }

  it("Acordo da o 1o a A e B vence a Coroacao: A continua Campeao e soma os pontos de 1o ao Encerrar", async () => {
    const { t, players, parts } = await setupFourAfterD();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 120, position: 2 },
      { playerId: c, amount: 80, position: 3 },
    ]);

    await eliminatePlayer(parts[2]); // C cai
    await eliminatePlayer(parts[0]); // A cai, e B é Coroado

    expect((await participantOf(b, t))?.status).toBe("finished");
    expect(await positionsOf(t, players)).toEqual([1, 2, 3, 4]);
    expect(await mesaChampion(t)).toBe("P0");

    await updateTournamentStatus(t, "finished");
    expect(Number((await participantOf(a, t))?.pointsEarned)).toBe(12);
    expect(Number((await participantOf(b, t))?.pointsEarned)).toBe(10);
    expect(await repeatedPositions()).toEqual([]);
  });

  it("Knockout de quem esta no Acordo nao muda a posicao do Acordo nem repete posicao", async () => {
    const { t, players, parts } = await setupFourAfterD();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: b, amount: 200, position: 1 },
      { playerId: c, amount: 120, position: 2 },
      { playerId: a, amount: 80, position: 3 },
    ]);

    await eliminatePlayer(parts[2]); // C cai antes de A, mas tem o 2º do Acordo
    expect(await positionsOf(t, players)).toEqual([3, 1, 2, 4]);
    expect(await repeatedPositions()).toEqual([]);

    await eliminatePlayer(parts[0]); // A cai, e B é Coroado
    expect(await positionsOf(t, players)).toEqual([3, 1, 2, 4]);
    expect(await mesaChampion(t)).toBe("P1");
  });

  it("Desfazer a Eliminacao de quem esta no Acordo devolve Em jogo com a posicao do Acordo", async () => {
    const { t, players, parts } = await setupFourAfterD();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: b, amount: 200, position: 1 },
      { playerId: c, amount: 120, position: 2 },
      { playerId: a, amount: 80, position: 3 },
    ]);
    await eliminatePlayer(parts[2]); // C cai

    expect(await undoElimination(parts[2])).toEqual({ success: true });

    expect((await participantOf(c, t))?.status).toBe("playing");
    expect(await positionsOf(t, players)).toEqual([3, 1, 2, 4]);
  });

  it("Desfazer a Coroacao mantem a posicao do Acordo do Coroado e tira o Campeao da Mesa", async () => {
    const { t, players, parts } = await setupFourAfterD();
    const [a, b, c] = players;
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 120, position: 2 },
      { playerId: c, amount: 80, position: 3 },
    ]);
    await eliminatePlayer(parts[2]); // C cai
    await eliminatePlayer(parts[0]); // A cai, e B é Coroado

    expect(await undoElimination(parts[1])).toEqual({ success: true });

    expect((await participantOf(b, t))?.status).toBe("playing");
    expect(await positionsOf(t, players)).toEqual([1, 2, 3, 4]);
    expect(await mesaChampion(t)).toBeNull();
  });

  it("buy-in tardio depois do Acordo nao muda as posicoes do Acordo", async () => {
    const { t, players } = await setupFourAfterD();
    const [a, b, , d] = players;
    const late = await seedParticipant(t, await seedPlayer("tardio"));
    // D já caiu (4º), mas o Acordo lhe dá o 3º; C, Em jogo, fica fora do Acordo.
    await distributePayouts(t, [
      { playerId: a, amount: 200, position: 1 },
      { playerId: b, amount: 120, position: 2 },
      { playerId: d, amount: 80, position: 3 },
    ]);

    expect(await confirmBuyIn(late)).toEqual({ success: true });

    expect(await positionsOf(t, players)).toEqual([1, 2, null, 3]);
  });

  it("desfazer o buy-in de quem esta no Acordo com Premio 0 e recusado", async () => {
    const { t, players, parts } = await setupFourAfterD();
    const [a, b] = players;
    // Prize pool 400; com 300 pagos, desfazer um buy-in ainda cabe no Saldo.
    await distributePayouts(t, [
      { playerId: a, amount: 300, position: 1 },
      { playerId: b, amount: 0, position: 2 },
    ]);

    expect(await undoBuyIn(parts[1])).toEqual({
      error: "Participante esta no Acordo: refaca a distribuicao de premios sem ele antes",
    });
    expect((await participantOf(b, t))?.buyInPaid).toBe(true);

    // Fora do Acordo, o buy-in volta a poder ser desfeito.
    await distributePayouts(t, [{ playerId: a, amount: 300, position: 1 }]);
    expect(await undoBuyIn(parts[1])).toEqual({ success: true });
  });
});

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { updatePrizeStructure, updateTournamentStatus } from "@/actions/tournaments";
import { distributePayouts } from "@/actions/participants";
import { getPrizeStructure } from "@/db/queries/tournaments";
import { getParticipantById, getParticipantByPlayerAndTournament } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { getSeasonRanking } from "@/db/queries/ranking";
import { testDb } from "@/test/db";
import { participants } from "@/db/schema";
import { seedTournament, seedPlayer, seedParticipant, seedSeason } from "@/test/setup";

describe("premios / pontos / ranking", () => {
  // A) updatePrizeStructure
  it("1. split válido grava as posições", async () => {
    const t = await seedTournament();
    const res = await updatePrizeStructure(t, [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 40 },
    ]);
    expect(res).not.toHaveProperty("error");
    const rows = await getPrizeStructure(t);
    expect(rows).toHaveLength(2);
    expect(Number(rows[0].percentage)).toBe(60);
    expect(Number(rows[1].percentage)).toBe(40);
  });

  it("2. soma ≠ 100 retorna error e não grava", async () => {
    const t = await seedTournament();
    const res = await updatePrizeStructure(t, [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
    ]);
    expect(res).toHaveProperty("error");
    expect(await getPrizeStructure(t)).toHaveLength(0);
  });

  it("3. substituição troca o conjunto de posições", async () => {
    const t = await seedTournament();
    await updatePrizeStructure(t, [
      { position: 1, percentage: 50 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 20 },
    ]);
    await updatePrizeStructure(t, [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 40 },
    ]);
    expect(await getPrizeStructure(t)).toHaveLength(2);
  });

  // B) distributePayouts
  it("4. distribui prêmios e registra transação", async () => {
    const t = await seedTournament();
    const A = await seedPlayer("A");
    const B = await seedPlayer("B");
    await seedParticipant(t, A, { status: "finished" });
    await seedParticipant(t, B, { status: "eliminated" });

    const res = await distributePayouts(t, [
      { playerId: A, amount: 300, position: 1 },
      { playerId: B, amount: 0, position: 2 },
    ]);
    expect(res).not.toHaveProperty("error");

    const pa = await getParticipantByPlayerAndTournament(A, t);
    expect(pa?.prizeAmount).toBe(300);
    expect(pa?.finishPosition).toBe(1);
    const pb = await getParticipantByPlayerAndTournament(B, t);
    expect(pb?.prizeAmount).toBe(0);
    expect((await getTournamentFinancialSummary(t)).prize).toBe(300);
  });

  it("5. re-executar substitui (não soma) os prêmios", async () => {
    const t = await seedTournament();
    const A = await seedPlayer("A");
    await seedParticipant(t, A, { status: "finished" });

    await distributePayouts(t, [{ playerId: A, amount: 300, position: 1 }]);
    await distributePayouts(t, [{ playerId: A, amount: 200, position: 1 }]);
    expect((await getTournamentFinancialSummary(t)).prize).toBe(200);
  });

  // C) Pontos no encerramento
  it("6. atribui pontos por posição ao finalizar", async () => {
    const t = await seedTournament();
    const parts: number[] = [];
    for (let pos = 1; pos <= 7; pos++) {
      const pl = await seedPlayer(`P${pos}`);
      parts.push(
        await seedParticipant(t, pl, {
          status: pos === 1 ? "finished" : "eliminated",
          finishPosition: pos,
        })
      );
    }
    await updateTournamentStatus(t, "finished");

    const expected = [12, 10, 8, 6, 4, 2, 1];
    for (let i = 0; i < parts.length; i++) {
      const p = await getParticipantById(parts[i]);
      expect(Number(p?.pointsEarned)).toBe(expected[i]);
    }
  });

  it("7. finalizar de novo não reescreve pontos (idempotência)", async () => {
    const t = await seedTournament();
    const pl = await seedPlayer();
    const part = await seedParticipant(t, pl, { status: "finished", finishPosition: 1 });

    await updateTournamentStatus(t, "finished");
    expect(Number((await getParticipantById(part))?.pointsEarned)).toBe(12);

    await testDb.update(participants).set({ pointsEarned: "999" }).where(eq(participants.id, part));
    // Re-finalizar quando o torneio já está "finished" cai no early-return guard
    // (tournaments.ts), ou seja é um no-op: os pontos não são recalculados, então 999 persiste.
    // (Não exercita o recálculo de pontos em si — apenas confirma o curto-circuito.)
    await updateTournamentStatus(t, "finished");
    expect(Number((await getParticipantById(part))?.pointsEarned)).toBe(999);
  });

  // D) Ranking
  it("8. agrega pontos, vitórias e torneios na temporada", async () => {
    const season = await seedSeason();
    const A = await seedPlayer("A");
    const B = await seedPlayer("B");

    for (const _ of [0, 1]) {
      const t = await seedTournament({ seasonId: season });
      await seedParticipant(t, A, { status: "finished", finishPosition: 1 });
      await seedParticipant(t, B, { status: "eliminated", finishPosition: 2 });
      await updateTournamentStatus(t, "finished");
    }

    const r = await getSeasonRanking(season);
    expect(r[0].playerId).toBe(A);
    expect(Number(r[0].totalPoints)).toBe(24);
    expect(Number(r[0].wins)).toBe(2);
    expect(Number(r[0].tournamentsPlayed)).toBe(2);
    expect(r[1].playerId).toBe(B);
    expect(Number(r[1].totalPoints)).toBe(20);
  });
});

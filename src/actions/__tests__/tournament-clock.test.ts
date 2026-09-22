import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { startTimer, pauseTimer, advanceBlindLevel, goBackBlindLevel, expireLevel, updateBlindStructure } from "@/actions/tournaments";
import { tournaments } from "@/db/schema";
import { testDb } from "@/test/db";
import { seedTournament, makeLevels } from "@/test/setup";

async function getTournament(t: number) {
  const [row] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
  return row;
}

describe("startTimer", () => {
  it("recusa 'Sem estrutura de blinds' quando o torneio não tem Níveis", async () => {
    const t = await seedTournament();
    const res = await startTimer(t);
    expect(res).toEqual({ error: "Sem estrutura de blinds" });
  });

  it("sem Tempo restante gravado, usa a duração cheia do Nível atual", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(3));

    const res = await startTimer(t);
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.timerRunning).toBe(true);
    expect(after.timerRemainingSecs).toBe(15 * 60);
    expect(after.timerStartedAt).not.toBeNull();
  });

  it("segundo clique concorrente com o Relógio já parado: só um sucede, o outro recebe 'A mesa mudou'", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(3));

    const [a, b] = await Promise.all([startTimer(t), startTimer(t)]);
    const results = [a, b];
    const successes = results.filter((r) => "success" in r);
    const conflicts = results.filter((r) => "error" in r && r.error === "A mesa mudou, recarregue e tente de novo");

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });
});

describe("pauseTimer", () => {
  it("recusa 'Timer nao esta rodando' quando o Relógio está parado", async () => {
    const t = await seedTournament();
    const res = await pauseTimer(t);
    expect(res).toEqual({ error: "Timer nao esta rodando" });
  });

  it("grava o Tempo restante daquele instante e limpa timerStartedAt", async () => {
    const t = await seedTournament({ timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 600 });
    const res = await pauseTimer(t);
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.timerRunning).toBe(false);
    expect(after.timerStartedAt).toBeNull();
    expect(after.timerRemainingSecs).toBeLessThanOrEqual(600);
    expect(after.timerRemainingSecs).toBeGreaterThanOrEqual(598);
  });

  it("segundo clique concorrente com o Relógio já rodando: só um sucede, o outro recebe 'A mesa mudou'", async () => {
    const t = await seedTournament({ timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 600 });

    const [a, b] = await Promise.all([pauseTimer(t), pauseTimer(t)]);
    const results = [a, b];
    const successes = results.filter((r) => "success" in r);
    const conflicts = results.filter((r) => "error" in r && r.error === "A mesa mudou, recarregue e tente de novo");

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const after = await getTournament(t);
    expect(after.timerRunning).toBe(false);
  });
});

describe("advanceBlindLevel", () => {
  it("aponta pro próximo Nível e mantém 'correndo' se já estava", async () => {
    const t = await seedTournament({ currentBlindLevel: 1, timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 5 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await advanceBlindLevel(t);
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.currentBlindLevel).toBe(2);
    expect(after.timerRunning).toBe(true);
    expect(after.timerStartedAt).not.toBeNull();
    expect(after.timerRemainingSecs).toBe(15 * 60);
  });

  it("aponta pro próximo Nível e permanece pausado se já estava", async () => {
    const t = await seedTournament({ currentBlindLevel: 1, timerRunning: false });
    await updateBlindStructure(t, makeLevels(3));

    const res = await advanceBlindLevel(t);
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.currentBlindLevel).toBe(2);
    expect(after.timerRunning).toBe(false);
    expect(after.timerStartedAt).toBeNull();
  });

  it("recusa 'Ja esta no ultimo nivel' quando não há próximo", async () => {
    const t = await seedTournament({ currentBlindLevel: 3 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await advanceBlindLevel(t);
    expect(res).toEqual({ error: "Ja esta no ultimo nivel" });
  });

  it("segundo clique concorrente com o Nível já alterado: só um sucede, o outro recebe 'A mesa mudou'", async () => {
    const t = await seedTournament({ currentBlindLevel: 1, timerRunning: false });
    await updateBlindStructure(t, makeLevels(3));

    const [a, b] = await Promise.all([advanceBlindLevel(t), advanceBlindLevel(t)]);
    const results = [a, b];
    expect(results.filter((r) => "success" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r && r.error === "A mesa mudou, recarregue e tente de novo")).toHaveLength(1);
  });
});

describe("goBackBlindLevel", () => {
  it("aponta pro Nível anterior e sempre pausa, mesmo se estava correndo", async () => {
    const t = await seedTournament({ currentBlindLevel: 2, timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 5 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await goBackBlindLevel(t);
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.currentBlindLevel).toBe(1);
    expect(after.timerRunning).toBe(false);
    expect(after.timerStartedAt).toBeNull();
    expect(after.timerRemainingSecs).toBe(15 * 60);
  });

  it("recusa 'Ja esta no primeiro nivel' quando não há anterior", async () => {
    const t = await seedTournament({ currentBlindLevel: 1 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await goBackBlindLevel(t);
    expect(res).toEqual({ error: "Ja esta no primeiro nivel" });
  });
});

describe("expireLevel", () => {
  it("instante observado defasado: sucesso sem mudar o Nível (outra tela já processou)", async () => {
    const startedAt = new Date();
    const t = await seedTournament({ currentBlindLevel: 1, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 0 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await expireLevel(t, "2020-01-01T00:00:00.000Z");
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.currentBlindLevel).toBe(1);
  });

  it("instante observado coincide: avança pro próximo Nível", async () => {
    const startedAt = new Date();
    const t = await seedTournament({ currentBlindLevel: 1, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 0 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await expireLevel(t, startedAt.toISOString());
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.currentBlindLevel).toBe(2);
  });

  it("no último Nível: sucesso sem mudar nada (Relógio fica em zero)", async () => {
    const startedAt = new Date();
    const t = await seedTournament({ currentBlindLevel: 3, timerRunning: true, timerStartedAt: startedAt, timerRemainingSecs: 0 });
    await updateBlindStructure(t, makeLevels(3));

    const res = await expireLevel(t, startedAt.toISOString());
    expect(res).toEqual({ success: true });

    const after = await getTournament(t);
    expect(after.currentBlindLevel).toBe(3);
  });
});

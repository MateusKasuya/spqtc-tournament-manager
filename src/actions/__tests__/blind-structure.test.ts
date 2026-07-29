import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { updateBlindStructure } from "@/actions/tournaments";
import { getBlindStructure } from "@/db/queries/tournaments";
import { tournaments } from "@/db/schema";
import { testDb } from "@/test/db";
import { seedTournament, makeLevels } from "@/test/setup";

async function seqState() {
  const seq = (await testDb.execute(
    sql`SELECT last_value, is_called FROM blind_structures_id_seq`
  )) as unknown as { rows: { last_value: number | string; is_called: boolean }[] };
  const max = (await testDb.execute(
    sql`SELECT COALESCE(MAX(id),0) AS max FROM blind_structures`
  )) as unknown as { rows: { max: number | string }[] };
  const row = seq.rows[0];
  const maxId = Number(max.rows[0].max);
  const nextval = row.is_called ? Number(row.last_value) + 1 : Number(row.last_value);
  return { nextval, maxId };
}

describe("updateBlindStructure", () => {
  it("edição repetida (load→save→load→save) não quebra e mantém os níveis", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(10));
    const loaded = await getBlindStructure(t);
    const res = await updateBlindStructure(t, loaded);
    expect(res).not.toHaveProperty("error");
    expect(await getBlindStructure(t)).toHaveLength(10);
  });

  it("ignora ids vindos do cliente e não colide com outro torneio (regressão)", async () => {
    const t1 = await seedTournament();
    const t2 = await seedTournament();
    await updateBlindStructure(t1, makeLevels(10));
    await updateBlindStructure(t2, makeLevels(10));
    const t2Levels = await getBlindStructure(t2);

    const res = await updateBlindStructure(t1, t2Levels);

    expect(res).not.toHaveProperty("error");
    expect(await getBlindStructure(t1)).toHaveLength(10);
    const { nextval, maxId } = await seqState();
    expect(nextval).toBeGreaterThan(maxId);
  });

  async function setCurrent(t: number, level: number, timer: Partial<typeof tournaments.$inferInsert> = {}) {
    await testDb
      .update(tournaments)
      .set({ currentBlindLevel: level, timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 777, ...timer })
      .where(eq(tournaments.id, t));
  }

  it("[regressão] reordenar niveis reancora currentBlindLevel pelo conteudo, sem mexer no timer", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(5));
    // Torneio esta jogando o nivel 3 (conteudo original: SB 30/BB 60)
    await setCurrent(t, 3);

    // Reordena: move o antigo nivel 3 pra posicao 1 (mesmo conteudo, numero novo)
    const original = makeLevels(5);
    const reordered = [original[2], original[0], original[1], original[3], original[4]].map((l, i) => ({
      ...l,
      level: i + 1,
    }));

    const res = await updateBlindStructure(t, reordered);
    expect(res).not.toHaveProperty("error");

    const [after] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
    expect(after.currentBlindLevel).toBe(1); // conteudo do nivel 3 antigo agora e o nivel 1
    expect(after.timerRunning).toBe(true); // mesmo nivel, so renumerado: timer nao deve ser mexido
    expect(after.timerRemainingSecs).toBe(777);
  });

  it("[regressão] editar os valores do nivel atual pausa e reseta o timer pra duracao cheia", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(5));
    await setCurrent(t, 3);

    const edited = makeLevels(5).map((l) =>
      l.level === 3 ? { ...l, durationMinutes: 20 } : l
    );

    const res = await updateBlindStructure(t, edited);
    expect(res).not.toHaveProperty("error");

    const [after] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
    expect(after.currentBlindLevel).toBe(3); // numero preservado, ja que ainda existe
    expect(after.timerRunning).toBe(false); // conteudo mudou: nao da pra saber quanto tempo restava
    expect(after.timerRemainingSecs).toBe(20 * 60);
    expect(after.timerStartedAt).toBeNull();
  });

  it("[regressão] remover o nivel atual (ou reduzir a lista) clampeia currentBlindLevel pro ultimo nivel valido", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(5));
    await setCurrent(t, 5);

    const shortened = makeLevels(3);
    const res = await updateBlindStructure(t, shortened);
    expect(res).not.toHaveProperty("error");

    const [after] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
    expect(after.currentBlindLevel).toBe(3);
    expect(after.timerRunning).toBe(false);
  });
});

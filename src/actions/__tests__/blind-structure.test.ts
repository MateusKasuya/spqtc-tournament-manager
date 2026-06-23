import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { updateBlindStructure } from "@/actions/tournaments";
import { getBlindStructure } from "@/db/queries/tournaments";
import { testDb } from "@/test/db";
import { seedTournament, makeLevels } from "@/test/setup";

async function seqState() {
  const r: any = await testDb.execute(sql`SELECT last_value, is_called FROM blind_structures_id_seq`);
  const m: any = await testDb.execute(sql`SELECT COALESCE(MAX(id),0) AS max FROM blind_structures`);
  const row = r.rows[0];
  const maxId = Number(m.rows[0].max);
  const nextval = row.is_called ? Number(row.last_value) + 1 : Number(row.last_value);
  return { nextval, maxId };
}

describe("updateBlindStructure", () => {
  it("edição repetida (load→save→load→save) não quebra e mantém os níveis", async () => {
    const t = await seedTournament();
    await updateBlindStructure(t, makeLevels(10));
    const loaded = await getBlindStructure(t);
    const res = await updateBlindStructure(t, loaded as any);
    expect(res).not.toHaveProperty("error");
    expect(await getBlindStructure(t)).toHaveLength(10);
  });

  it("ignora ids vindos do cliente e não colide com outro torneio (regressão)", async () => {
    const t1 = await seedTournament();
    const t2 = await seedTournament();
    await updateBlindStructure(t1, makeLevels(10));
    await updateBlindStructure(t2, makeLevels(10));
    const t2Levels = await getBlindStructure(t2);

    const res = await updateBlindStructure(t1, t2Levels as any);

    expect(res).not.toHaveProperty("error");
    expect(await getBlindStructure(t1)).toHaveLength(10);
    const { nextval, maxId } = await seqState();
    expect(nextval).toBeGreaterThan(maxId);
  });
});

import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { checkDatabase, readJournal, type CheckMode } from "@/db/check-database";
import { supabaseLikePg } from "@/test/supabase-like";

// A conferência do banco roda sobre pglite "parecido com Supabase", com as
// migrations aplicadas pelo migrator do drizzle (que grava a tabela de controle
// drizzle.__drizzle_migrations, como o `pnpm db:migrate`). O pglite aceita a
// publicação supabase_realtime e o trigger em auth.users, então esses itens são
// conferidos de verdade aqui, e não só reportados.
const migrationsFolder = fileURLToPath(new URL("../../../drizzle/migrations", import.meta.url));
const journal = readJournal(migrationsFolder);
const last = journal[journal.length - 1];
const MODES: CheckMode[] = ["manual", "deploy"];

async function migrated(pg: PGlite) {
  const db = drizzle(pg);
  await migrate(db, { migrationsFolder });
  return db;
}

async function supabaseDb() {
  const pg = await supabaseLikePg();
  return { pg, db: await migrated(pg) };
}

describe("conferência do banco", () => {
  describe.each(MODES)("modo %s", (mode) => {
    it("banco em dia: sem drift, em transação read only", async () => {
      const { db } = await supabaseDb();
      const { facts, drift, report } = await checkDatabase(db, { mode, journal });

      expect(drift).toEqual([]);
      expect(facts.readOnly).toBe("on");
      expect(facts.appliedMigrations).toEqual(journal.map((e) => e.when));
      expect(facts.tables.every((t) => t.rls)).toBe(true);
      expect(facts.policies).toContainEqual({
        table: "users", name: "users_select_own", command: "SELECT", roles: ["authenticated"],
      });
      expect(facts.publicationTables).toEqual(
        ["blind_structures", "participants", "prize_structures", "tournaments"]
      );
      expect(facts.authUserTriggers).toEqual([
        { name: "on_auth_user_created", fn: "handle_new_user", enabled: true },
      ]);
      expect(report).toContain("Transacao read only: on");
      expect(report).toContain(`  aplicada  ${last.tag}`);
      expect(report).toContain("  on_auth_user_created -> handle_new_user()");
      expect(report.endsWith("Drift: nenhum")).toBe(true);
    });

    it("migration do journal pendente é drift", async () => {
      const { pg, db } = await supabaseDb();
      await pg.query(`DELETE FROM drizzle.__drizzle_migrations WHERE created_at = $1`, [last.when]);

      const { drift, report } = await checkDatabase(db, { mode, journal });

      expect(drift).toEqual([
        `migration nao aplicada: ${last.tag}`,
        `journal tem ${journal.length} migrations e o banco tem ${journal.length - 1}`,
      ]);
      expect(report).toContain(`  PENDENTE  ${last.tag}`);
    });

    it("entrada do journal com when anterior à última aplicada conta como não aplicada", async () => {
      // O migrator do drizzle só aplica `when` maior que o da última aplicada:
      // esta entrada nunca seria aplicada, e sem a conferência passaria calada.
      const { db } = await supabaseDb();
      const renamed = { tag: "0008_renomeada_a_mao", when: journal[3].when + 1 };

      const { drift, report } = await checkDatabase(db, { mode, journal: [...journal, renamed] });

      expect(drift).toEqual([
        `migration nao aplicada: ${renamed.tag}`,
        `journal tem ${journal.length + 1} migrations e o banco tem ${journal.length}`,
      ]);
      expect(report).toContain(`  PENDENTE  ${renamed.tag}`);
    });

    it("tabela de public sem RLS é drift", async () => {
      const { pg, db } = await supabaseDb();
      await pg.exec(`ALTER TABLE public.seasons DISABLE ROW LEVEL SECURITY`);

      const { drift, report } = await checkDatabase(db, { mode, journal });

      expect(drift).toEqual(["tabela public.seasons sem RLS"]);
      expect(report).toContain("  SEM RLS  seasons");
    });

    it("tabela da Mesa ao vivo fora da publicação é drift", async () => {
      const { pg, db } = await supabaseDb();
      await pg.exec(`ALTER PUBLICATION supabase_realtime DROP TABLE public.prize_structures`);

      const { drift, report } = await checkDatabase(db, { mode, journal });

      expect(drift).toEqual(["tabela prize_structures fora da publicacao supabase_realtime"]);
      expect(report).toContain("  FALTANDO  prize_structures (Mesa ao vivo)");
    });

    it("trigger on_auth_user_created ausente ou desativado é drift", async () => {
      const { pg, db } = await supabaseDb();
      await pg.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created`);
      expect((await checkDatabase(db, { mode, journal })).drift).toEqual([
        "trigger on_auth_user_created desativado em auth.users",
      ]);

      await pg.exec(`DROP TRIGGER on_auth_user_created ON auth.users`);
      expect((await checkDatabase(db, { mode, journal })).drift).toEqual([
        "trigger on_auth_user_created ausente em auth.users",
      ]);
    });

    it("fora do Supabase, publicação e auth.users só aparecem no relatório", async () => {
      const db = await migrated(new PGlite());

      const { facts, drift, report } = await checkDatabase(db, { mode, journal });

      expect(facts.publicationTables).toBeNull();
      expect(facts.authUserTriggers).toBeNull();
      expect(drift.filter((d) => /publicacao|auth\.users/.test(d))).toEqual([]);
      expect(report).toContain("Publicacao supabase_realtime: nao existe (banco fora do Supabase), nao checada");
      expect(report).toContain("Triggers em auth.users: schema auth ausente (banco fora do Supabase), nao checados");
    });

    it("banco sem a tabela de controle do drizzle tem o journal inteiro pendente", async () => {
      const db = drizzle(await supabaseLikePg());

      const { facts, drift, report } = await checkDatabase(db, { mode, journal });

      expect(facts.appliedMigrations).toBeNull();
      expect(drift).toContain(`migration nao aplicada: ${journal[0].tag}`);
      expect(drift).toContain(`journal tem ${journal.length} migrations e o banco tem 0`);
      expect(report).toContain(
        `Migrations: journal ${journal.length}, tabela drizzle.__drizzle_migrations ausente`
      );
    });
  });

  describe("banco com uma migration a mais que o journal (Redeploy de commit antigo)", () => {
    const olderJournal = journal.slice(0, -1);

    it("no modo manual é drift", async () => {
      const { db } = await supabaseDb();

      const { drift } = await checkDatabase(db, { mode: "manual", journal: olderJournal });

      expect(drift).toEqual([
        `journal tem ${olderJournal.length} migrations e o banco tem ${journal.length}`,
      ]);
    });

    it("no modo deploy só aparece no relatório", async () => {
      const { db } = await supabaseDb();

      const { drift, report } = await checkDatabase(db, { mode: "deploy", journal: olderJournal });

      expect(drift).toEqual([]);
      expect(report).toContain(`Migrations: journal ${olderJournal.length}, banco ${journal.length}`);
      expect(report).toContain("banco a frente do journal");
      expect(report.endsWith("Drift: nenhum")).toBe(true);
    });
  });
});

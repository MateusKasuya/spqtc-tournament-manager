import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { supabaseLikePg } from "@/test/supabase-like";

// A migration de RLS só age no Supabase (papéis anon/authenticated e auth.uid()).
// Aqui o pglite imita esse ambiente para provar o que ela libera e o que ela barra.
// O banco é montado aplicando as migrations na ordem do journal, como no Supabase:
// a 0006 liga RLS só nas tabelas que já existem quando ela roda, então tabela criada
// por migration posterior sem a sua própria migration de RLS fica aberta — e o teste
// "toda tabela do schema tem RLS" fica vermelho.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const schemaSql = read("../../test/schema.sql");
const rlsMigrationSql = read("../../../drizzle/migrations/0006_rls_tabelas_public.sql");
const journal: { entries: { tag: string }[] } = JSON.parse(
  read("../../../drizzle/migrations/meta/_journal.json")
);
const migrations = journal.entries.map((e) => read(`../../../drizzle/migrations/${e.tag}.sql`));

async function applyMigrations(pg: PGlite) {
  for (const m of migrations) await pg.exec(m);
}

const ME = "00000000-0000-0000-0000-00000000000a";
const OTHER = "00000000-0000-0000-0000-00000000000b";

// As tabelas reais: o DDL gerado do schema TS (`pnpm test:schema`).
async function schemaTables() {
  const pg = new PGlite();
  await pg.exec(schemaSql);
  const { rows } = await pg.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
  );
  return rows.map((r) => r.tablename);
}

async function supabaseLike() {
  const pg = await supabaseLikePg();
  await applyMigrations(pg);
  await pg.exec(`
    INSERT INTO users (id, email, name, role) VALUES
      ('${ME}', 'me@t.com', 'Eu', 'player'),
      ('${OTHER}', 'other@t.com', 'Outro', 'admin');
    INSERT INTO tournaments (name, date, buy_in_amount, initial_chips, created_by)
      VALUES ('T', now(), 100, 10000, '${OTHER}');
    INSERT INTO players (name) VALUES ('P');
  `);
  return pg;
}

async function as(pg: PGlite, role: "anon" | "authenticated", sub: string | null, sql: string) {
  return pg.transaction(async (tx) => {
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ""]);
    await tx.exec(`SET LOCAL ROLE ${role}`);
    return tx.query<Record<string, unknown>>(sql);
  });
}

describe("migration de RLS nas tabelas public", () => {
  it("fora do Supabase não faz nada", async () => {
    const pg = new PGlite();
    await pg.exec(schemaSql);
    await pg.exec(rlsMigrationSql);
    const { rows } = await pg.query<{ n: number }>(
      `SELECT count(*)::int n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
       WHERE s.nspname = 'public' AND c.relrowsecurity`
    );
    expect(rows[0].n).toBe(0);
  });

  describe("no Supabase", () => {
    let pg: PGlite;
    let tables: string[];
    let rlsTables: string[];
    beforeAll(async () => {
      tables = await schemaTables();
      pg = await supabaseLike();
      // Lido antes de rodar a 0006 de novo: a re-execução ligaria RLS em tudo e
      // esconderia a tabela que ficou de fora.
      const { rows } = await pg.query<{ relname: string }>(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
         WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity ORDER BY 1`
      );
      rlsTables = rows.map((r) => r.relname);
      await pg.exec(rlsMigrationSql); // idempotente
    });

    it("toda tabela do schema tem RLS ligado depois das migrations", () => {
      // Vermelho aqui = tabela nova sem migration custom que liga o RLS
      // (`pnpm db:generate --custom`), ou tabela do schema TS sem migration nenhuma.
      expect(tables).toContain("users");
      expect(rlsTables).toEqual(tables);
    });

    it("cria só policies de leitura", async () => {

      const policies = await pg.query<{ tablename: string; cmd: string; roles: string }>(
        `SELECT tablename, cmd, roles::text FROM pg_policies WHERE schemaname = 'public' ORDER BY 1`
      );
      expect(policies.rows).toEqual(
        ["blind_structures", "participants", "prize_structures", "tournaments", "users"].map(
          (tablename) => ({ tablename, cmd: "SELECT", roles: "{authenticated}" })
        )
      );
    });

    it("anon não lê nem escreve nada", async () => {
      for (const t of tables) {
        expect((await as(pg, "anon", null, `SELECT * FROM ${t}`)).rows).toEqual([]);
      }
      expect((await as(pg, "anon", null, `UPDATE users SET role = 'admin'`)).affectedRows).toBe(0);
      expect((await as(pg, "anon", null, `DELETE FROM tournaments`)).affectedRows).toBe(0);
      await expect(as(pg, "anon", null, `INSERT INTO players (name) VALUES ('X')`)).rejects.toThrow(
        /row-level security/
      );
    });

    it("logado lê só o próprio perfil e não consegue se promover", async () => {
      const own = await as(pg, "authenticated", ME, `SELECT id, role FROM users`);
      expect(own.rows).toEqual([{ id: ME, role: "player" }]);

      const promote = await as(pg, "authenticated", ME, `UPDATE users SET role = 'admin' WHERE id = '${ME}'`);
      expect(promote.affectedRows).toBe(0);
      const { rows } = await pg.query<{ role: string }>(`SELECT role FROM users WHERE id = '${ME}'`);
      expect(rows[0].role).toBe("player");
    });

    it("logado lê a mesa, mas não escreve nela", async () => {
      expect((await as(pg, "authenticated", ME, `SELECT id FROM tournaments`)).rows).toHaveLength(1);
      for (const t of ["participants", "blind_structures", "prize_structures"]) {
        await expect(as(pg, "authenticated", ME, `SELECT * FROM ${t}`)).resolves.toBeDefined();
      }
      expect(
        (await as(pg, "authenticated", ME, `UPDATE tournaments SET status = 'finished'`)).affectedRows
      ).toBe(0);
      expect((await as(pg, "authenticated", ME, `DELETE FROM tournaments`)).affectedRows).toBe(0);
    });

    it("logado não lê o que a mesa não usa", async () => {
      for (const t of ["players", "transactions", "seasons", "blind_templates", "prize_templates"]) {
        expect((await as(pg, "authenticated", ME, `SELECT * FROM ${t}`)).rows).toEqual([]);
      }
    });
  });
});

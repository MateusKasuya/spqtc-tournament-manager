import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJournal } from "@/db/check-database";
import { deployMigrations, type DeployEnv } from "@/db/deploy-migrations";
import { supabaseLikePg } from "@/test/supabase-like";

// A migration do build de Production (ADR 0004) roda sobre pglite "parecido com
// Supabase". Os testes olham só o resultado e o estado final do banco.
const migrationsFolder = fileURLToPath(new URL("../../../drizzle/migrations", import.meta.url));
const journal = readJournal(migrationsFolder);
const last = journal[journal.length - 1];

const PRODUCTION: DeployEnv = {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  MIGRATION_DATABASE_URL: "postgres://pooler-de-sessao",
};

async function hasControlTable(pg: PGlite) {
  const { rows } = await pg.query<{ exists: boolean }>(
    `SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`
  );
  return rows[0].exists;
}

type ExtraMigration = { tag: string; when: number; sql: string };

// Pasta de migrations temporária: as `count` primeiras do repo e mais as extras,
// no formato que o drizzle lê (meta/_journal.json + <tag>.sql).
function folderWith(count: number, extra: ExtraMigration[] = []) {
  const folder = mkdtempSync(path.join(tmpdir(), "migrations-"));
  mkdirSync(path.join(folder, "meta"));
  const real = journal.slice(0, count);
  for (const entry of real) {
    copyFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
  }
  for (const entry of extra) writeFileSync(path.join(folder, `${entry.tag}.sql`), entry.sql);
  const entries = [...real, ...extra].map(({ tag, when }, idx) => ({
    idx, version: "7", when, tag, breakpoints: true,
  }));
  writeFileSync(
    path.join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries })
  );
  return folder;
}

// Banco já com as `count` primeiras migrations, aplicadas como o `pnpm db:migrate`.
async function dbWith(count: number) {
  const pg = await supabaseLikePg();
  await migrate(drizzle(pg), { migrationsFolder: folderWith(count) });
  return pg;
}

async function appliedWhens(pg: PGlite) {
  const { rows } = await pg.query<{ created_at: number }>(
    `SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`
  );
  return rows.map((r) => Number(r.created_at));
}

async function publicTables(pg: PGlite) {
  const { rows } = await pg.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
  );
  return rows.map((r) => r.tablename);
}

async function advisoryLocks(pg: PGlite) {
  const { rows } = await pg.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory'`
  );
  return rows[0].n;
}

// Conexão aberta sob demanda, como o script faz com o postgres-js.
function connectTo(pg: PGlite) {
  const opened: string[] = [];
  const connect = (url: string) => {
    opened.push(url);
    return drizzle(pg);
  };
  return { connect, opened };
}

describe("migration no build de Production", () => {
  it.each([
    [{ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/x" }, "VERCEL_ENV=preview"],
    [{ VERCEL_ENV: "development" }, "VERCEL_ENV=development"],
    [{}, "VERCEL_ENV=(indefinida)"],
  ] as [DeployEnv, string][])("fora de Production (%o): pula sem abrir conexão", async (env, seen) => {
    const pg = await supabaseLikePg();
    const { connect, opened } = connectTo(pg);

    const outcome = await deployMigrations(
      { ...env, MIGRATION_DATABASE_URL: "postgres://x" }, connect, { migrationsFolder }
    );

    expect(outcome).toEqual({ status: "skipped", reason: expect.stringContaining(seen) });
    expect(opened).toEqual([]);
    expect(await hasControlTable(pg)).toBe(false);
  });

  it("Production com ref diferente de main: falha, banco intocado", async () => {
    // É o Preview promovido a Production: o build refeito migraria uma branch não mergeada.
    const pg = await supabaseLikePg();
    const { connect, opened } = connectTo(pg);

    const outcome = await deployMigrations(
      { ...PRODUCTION, VERCEL_GIT_COMMIT_REF: "feat/x" }, connect, { migrationsFolder }
    );

    expect(outcome).toEqual({
      status: "failed", reason: expect.stringContaining("VERCEL_GIT_COMMIT_REF=feat/x"),
    });
    expect(opened).toEqual([]);
    expect(await hasControlTable(pg)).toBe(false);
  });

  it("banco vazio: migra até o fim do journal, passa e solta a trava", async () => {
    const pg = await supabaseLikePg();
    const { connect, opened } = connectTo(pg);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder });

    expect(outcome).toEqual({
      status: "migrated",
      applied: journal.map((e) => e.tag),
      report: expect.stringMatching(/Drift: nenhum$/),
    });
    expect(opened).toEqual([PRODUCTION.MIGRATION_DATABASE_URL]);
    expect(await appliedWhens(pg)).toEqual(journal.map((e) => e.when));
    expect(await advisoryLocks(pg)).toBe(0);
  });

  it("banco atrasado: aplica o resto e passa", async () => {
    const pg = await dbWith(5);
    const { connect } = connectTo(pg);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder });

    expect(outcome).toEqual({
      status: "migrated",
      applied: journal.slice(5).map((e) => e.tag),
      report: expect.stringMatching(/Drift: nenhum$/),
    });
    expect(await appliedWhens(pg)).toEqual(journal.map((e) => e.when));
  });

  it("migration quebrada no meio do lote: falha, nenhuma do lote fica, solta a trava", async () => {
    const pg = await dbWith(journal.length);
    const { connect } = connectTo(pg);
    const folder = folderWith(journal.length, [
      { tag: "0008_boa", when: last.when + 1000, sql: "CREATE TABLE boa (id int);" },
      { tag: "0009_quebrada", when: last.when + 2000, sql: "SELECT * FROM tabela_que_nao_existe;" },
      { tag: "0010_depois", when: last.when + 3000, sql: "CREATE TABLE depois (id int);" },
    ]);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder: folder });

    expect(outcome).toEqual({
      status: "failed", reason: expect.stringContaining("tabela_que_nao_existe"),
    });
    expect(await appliedWhens(pg)).toEqual(journal.map((e) => e.when));
    expect(await publicTables(pg)).not.toContain("boa");
    expect(await advisoryLocks(pg)).toBe(0);
  });

  it("tabela de public sem RLS depois de migrar: falha e o relatório cita a tabela", async () => {
    const pg = await dbWith(journal.length);
    const { connect } = connectTo(pg);
    const folder = folderWith(journal.length, [
      { tag: "0008_sem_rls", when: last.when + 1000, sql: "CREATE TABLE aberta (id int);" },
    ]);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder: folder });

    expect(outcome).toEqual({
      status: "failed",
      reason: expect.stringContaining("drift"),
      report: expect.stringContaining("tabela public.aberta sem RLS"),
    });
    expect(await advisoryLocks(pg)).toBe(0);
  });

  it("banco com uma migration a mais que o journal: passa (Redeploy de commit antigo)", async () => {
    const pg = await dbWith(journal.length);
    const { connect } = connectTo(pg);
    const folder = folderWith(journal.length - 1);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder: folder });

    expect(outcome).toEqual({
      status: "migrated",
      applied: [],
      report: expect.stringContaining("banco a frente do journal"),
    });
    expect(await appliedWhens(pg)).toEqual(journal.map((e) => e.when));
  });

  it("entrada do journal com when anterior à última aplicada: falha como não aplicada", async () => {
    // O migrator do drizzle só aplica `when` maior que o da última aplicada e pula
    // esta sem avisar: só a conferência pega.
    const pg = await dbWith(journal.length);
    const { connect } = connectTo(pg);
    const folder = folderWith(journal.length, [
      { tag: "0008_renomeada", when: journal[3].when + 1, sql: "CREATE TABLE renomeada (id int);" },
    ]);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder: folder });

    expect(outcome).toEqual({
      status: "failed",
      reason: expect.stringContaining("drift"),
      report: expect.stringContaining("migration nao aplicada: 0008_renomeada"),
    });
    expect(await publicTables(pg)).not.toContain("renomeada");
  });

  it("segunda execução com o banco em dia: passa sem migrar nada", async () => {
    const pg = await supabaseLikePg();
    const { connect } = connectTo(pg);
    await deployMigrations(PRODUCTION, connect, { migrationsFolder });

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder });

    expect(outcome).toEqual({
      status: "migrated", applied: [], report: expect.stringMatching(/Drift: nenhum$/),
    });
    expect(await appliedWhens(pg)).toEqual(journal.map((e) => e.when));
  });

  it("banco inalcançável: falha com o motivo, sem lançar", async () => {
    const pg = new PGlite();
    await pg.close();
    const { connect } = connectTo(pg);

    const outcome = await deployMigrations(PRODUCTION, connect, { migrationsFolder });

    expect(outcome).toEqual({
      status: "failed", reason: expect.stringContaining("PGlite is closed"),
    });
  });

  it.each(["", undefined])("Production sem MIGRATION_DATABASE_URL (%o): falha", async (url) => {
    const pg = await supabaseLikePg();
    const { connect, opened } = connectTo(pg);

    const outcome = await deployMigrations(
      { ...PRODUCTION, MIGRATION_DATABASE_URL: url }, connect, { migrationsFolder }
    );

    expect(outcome).toEqual({
      status: "failed", reason: expect.stringContaining("MIGRATION_DATABASE_URL"),
    });
    expect(opened).toEqual([]);
    expect(await hasControlTable(pg)).toBe(false);
  });
});


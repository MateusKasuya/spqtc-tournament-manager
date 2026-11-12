/**
 * Conferência do banco: compara o banco com o que o repo espera, só em leitura
 * (migrations do journal, RLS e policies de public, publicação do Realtime e o
 * trigger de auth.users). Recebe a conexão Drizzle de qualquer driver
 * (postgres-js no `pnpm db:check`, pglite nos testes).
 *
 * Modos:
 * - manual (`pnpm db:check`): banco à frente do journal é drift.
 * - deploy (build de Production, ADR 0004): banco à frente do journal só aparece
 *   no relatório, porque é o caso do Redeploy de um commit antigo.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
// relativo, e não @/, porque o `pnpm db:check` roda este módulo pelo tsx
import { MESA_REALTIME_TABLES } from "../lib/mesa-realtime";

export const MIGRATIONS_FOLDER = "drizzle/migrations";
const PUBLICATION = "supabase_realtime";
const AUTH_USER_TRIGGER = "on_auth_user_created";

export type CheckMode = "manual" | "deploy";

export type JournalEntry = { tag: string; when: number };

export type DbFacts = {
  readOnly: string;
  // null: tabela de controle do drizzle não existe
  appliedMigrations: number[] | null;
  tables: { name: string; rls: boolean }[];
  policies: { table: string; name: string; command: string; roles: string[] }[];
  // null: publicação não existe (banco fora do Supabase)
  publicationTables: string[] | null;
  // null: auth.users não existe (banco fora do Supabase)
  authUserTriggers: { name: string; fn: string; enabled: boolean }[] | null;
};

export type DbCheckResult = {
  facts: DbFacts;
  // vazio: sem drift
  drift: string[];
  report: string;
};

export type CheckConnection = PgDatabase<PgQueryResultHKT>;

export function readJournal(migrationsFolder = MIGRATIONS_FOLDER): JournalEntry[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] };
  return journal.entries;
}

export async function checkDatabase(
  db: CheckConnection,
  { mode, journal }: { mode: CheckMode; journal: JournalEntry[] }
): Promise<DbCheckResult> {
  const facts = await collectFacts(db);
  const drift = findDrift(mode, journal, facts);
  return { facts, drift, report: formatReport(mode, journal, facts, drift) };
}

// Motivo de uma conferência que não rodou (exit 2). O drizzle embrulha toda falha
// de query num DrizzleQueryError cuja message é só "Failed query: <SQL>"; o motivo
// real (permission denied, timeout, conexão caída) fica no `cause`.
export function checkFailureReason(error: unknown): string {
  let current = error;
  while (current instanceof Error && current.cause instanceof Error) current = current.cause;
  return current instanceof Error ? current.message : String(current);
}

// O db.execute do drizzle devolve a lista de linhas no postgres-js e { rows } no pglite.
async function rowsOf<T>(db: CheckConnection, statement: SQL): Promise<T[]> {
  const result: unknown = await db.execute(statement);
  if (Array.isArray(result)) return result as T[];
  return (result as { rows: T[] }).rows;
}

async function collectFacts(db: CheckConnection): Promise<DbFacts> {
  return db.transaction(
    async (tx) => {
      const run = <T>(statement: SQL) => rowsOf<T>(tx, statement);

      const [{ transaction_read_only: readOnly }] = await run<{ transaction_read_only: string }>(
        sql`SHOW transaction_read_only`
      );

      const [{ exists: hasMigrationsTable }] = await run<{ exists: boolean }>(
        sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`
      );
      // created_at é bigint: o postgres-js devolve string, o pglite devolve number
      const appliedMigrations = hasMigrationsTable
        ? (
            await run<{ created_at: string | number }>(
              sql`SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`
            )
          ).map((row) => Number(row.created_at))
        : null;

      const tables = await run<{ name: string; rls: boolean }>(sql`
        SELECT c.relname AS name, c.relrowsecurity AS rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        ORDER BY c.relname
      `);

      const policies = await run<DbFacts["policies"][number]>(sql`
        SELECT tablename AS table, policyname AS name, cmd AS command, roles::text[] AS roles
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `);

      const [{ exists: hasPublication }] = await run<{ exists: boolean }>(
        sql`SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = ${PUBLICATION}) AS exists`
      );
      const publicationTables = hasPublication
        ? (
            await run<{ name: string }>(sql`
              SELECT tablename AS name
              FROM pg_publication_tables
              WHERE pubname = ${PUBLICATION} AND schemaname = 'public'
              ORDER BY tablename
            `)
          ).map((row) => row.name)
        : null;

      // o cast para regclass lança se a tabela não existe: checar antes
      const [{ exists: hasAuthUsers }] = await run<{ exists: boolean }>(
        sql`SELECT to_regclass('auth.users') IS NOT NULL AS exists`
      );
      const authUserTriggers = hasAuthUsers
        ? await run<{ name: string; fn: string; enabled: boolean }>(sql`
            SELECT t.tgname AS name, p.proname AS fn, t.tgenabled <> 'D' AS enabled
            FROM pg_trigger t
            JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
            ORDER BY t.tgname
          `)
        : null;

      return { readOnly, appliedMigrations, tables, policies, publicationTables, authUserTriggers };
    },
    { accessMode: "read only" }
  );
}

// Não aplicada é toda entrada do journal cujo `when` não está entre os created_at
// gravados (o migrator do drizzle grava o `when` como created_at). Inclui a entrada
// mais nova que a última aplicada, que o migrator ainda vai aplicar, e a com `when`
// anterior à última aplicada, que ele pula sem avisar.
function pendingMigrations(journal: JournalEntry[], applied: number[] | null): JournalEntry[] {
  const appliedSet = new Set(applied ?? []);
  return journal.filter((entry) => !appliedSet.has(entry.when));
}

// Banco com mais migrations que o journal: só reportado no modo deploy.
function isAheadOfJournal(journal: JournalEntry[], facts: DbFacts) {
  return (facts.appliedMigrations?.length ?? 0) > journal.length;
}

function findDrift(mode: CheckMode, journal: JournalEntry[], facts: DbFacts): string[] {
  const drift: string[] = [];

  for (const entry of pendingMigrations(journal, facts.appliedMigrations)) {
    drift.push(`migration nao aplicada: ${entry.tag}`);
  }
  const appliedCount = facts.appliedMigrations?.length ?? 0;
  const ahead = isAheadOfJournal(journal, facts);
  if (appliedCount < journal.length || (ahead && mode === "manual")) {
    drift.push(`journal tem ${journal.length} migrations e o banco tem ${appliedCount}`);
  }

  for (const table of facts.tables.filter((t) => !t.rls)) {
    drift.push(`tabela public.${table.name} sem RLS`);
  }

  if (facts.publicationTables) {
    for (const table of MESA_REALTIME_TABLES) {
      if (!facts.publicationTables.includes(table)) {
        drift.push(`tabela ${table} fora da publicacao ${PUBLICATION}`);
      }
    }
  }

  if (facts.authUserTriggers) {
    const trigger = facts.authUserTriggers.find((t) => t.name === AUTH_USER_TRIGGER);
    if (!trigger) drift.push(`trigger ${AUTH_USER_TRIGGER} ausente em auth.users`);
    else if (!trigger.enabled) drift.push(`trigger ${AUTH_USER_TRIGGER} desativado em auth.users`);
  }

  return drift;
}

function formatReport(mode: CheckMode, journal: JournalEntry[], facts: DbFacts, drift: string[]) {
  const lines: string[] = [];
  lines.push(`Transacao read only: ${facts.readOnly}`);

  const pending = new Set(pendingMigrations(journal, facts.appliedMigrations).map((e) => e.tag));
  lines.push("");
  lines.push(
    facts.appliedMigrations
      ? `Migrations: journal ${journal.length}, banco ${facts.appliedMigrations.length}`
      : `Migrations: journal ${journal.length}, tabela drizzle.__drizzle_migrations ausente`
  );
  for (const entry of journal) {
    lines.push(`  ${pending.has(entry.tag) ? "PENDENTE" : "aplicada"}  ${entry.tag}`);
  }
  if (mode === "deploy" && isAheadOfJournal(journal, facts)) {
    lines.push("  banco a frente do journal (Redeploy de commit antigo): so reportado no deploy");
  }

  lines.push("");
  lines.push(`RLS em public: ${facts.tables.filter((t) => t.rls).length} de ${facts.tables.length} tabelas`);
  for (const table of facts.tables) {
    lines.push(`  ${table.rls ? "ligado " : "SEM RLS"}  ${table.name}`);
  }

  lines.push("");
  lines.push(`Policies em public: ${facts.policies.length}`);
  for (const policy of facts.policies) {
    lines.push(`  ${policy.table}  ${policy.name}  ${policy.command}  ${policy.roles.join(",")}`);
  }

  lines.push("");
  if (facts.publicationTables) {
    lines.push(`Publicacao ${PUBLICATION}: ${facts.publicationTables.join(", ") || "(vazia)"}`);
    for (const table of MESA_REALTIME_TABLES) {
      const ok = facts.publicationTables.includes(table);
      lines.push(`  ${ok ? "presente" : "FALTANDO"}  ${table} (Mesa ao vivo)`);
    }
  } else {
    lines.push(`Publicacao ${PUBLICATION}: nao existe (banco fora do Supabase), nao checada`);
  }

  lines.push("");
  if (facts.authUserTriggers) {
    lines.push(`Triggers em auth.users: ${facts.authUserTriggers.length}`);
    for (const trigger of facts.authUserTriggers) {
      lines.push(`  ${trigger.name} -> ${trigger.fn}()${trigger.enabled ? "" : " DESATIVADO"}`);
    }
  } else {
    lines.push("Triggers em auth.users: schema auth ausente (banco fora do Supabase), nao checados");
  }

  lines.push("");
  if (drift.length === 0) {
    lines.push("Drift: nenhum");
  } else {
    lines.push(`Drift: ${drift.length}`);
    for (const item of drift) lines.push(`  - ${item}`);
  }

  return lines.join("\n");
}

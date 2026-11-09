/**
 * Confere o banco de DATABASE_URL (.env.local) contra o que o repo espera, só em
 * leitura: migrations do journal, RLS e policies de public, publicação do Realtime
 * e o trigger de auth.users.
 * Run: pnpm db:check — exit 0 sem drift, 1 com drift, 2 se não conseguiu checar.
 */

import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";
import { MESA_REALTIME_TABLES } from "../src/lib/mesa-realtime";

config({ path: ".env.local", quiet: true });

const JOURNAL_PATH = "drizzle/migrations/meta/_journal.json";
const PUBLICATION = "supabase_realtime";
const AUTH_USER_TRIGGER = "on_auth_user_created";

type JournalEntry = { tag: string; when: number };

type DbFacts = {
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

function readJournal(): JournalEntry[] {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as { entries: JournalEntry[] };
  return journal.entries;
}

async function collectFacts(sql: postgres.Sql): Promise<DbFacts> {
  return sql.begin("read only", async (transaction) => {
    // os tipos do postgres declaram TransactionSql com Omit<Sql>, que perde a
    // assinatura de tagged template; em runtime ela existe
    const tx = transaction as unknown as postgres.Sql;
    const [{ transaction_read_only: readOnly }] = await tx<{ transaction_read_only: string }[]>`
      SHOW transaction_read_only
    `;

    const [{ exists: hasMigrationsTable }] = await tx<{ exists: boolean }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists
    `;
    // created_at é bigint: o driver devolve string
    const appliedMigrations = hasMigrationsTable
      ? (
          await tx<{ created_at: string }[]>`
            SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
          `
        ).map((row) => Number(row.created_at))
      : null;

    const tables = await tx<{ name: string; rls: boolean }[]>`
      SELECT c.relname AS name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `;

    const policies = await tx<DbFacts["policies"]>`
      SELECT tablename AS table, policyname AS name, cmd AS command, roles::text[] AS roles
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `;

    const [{ exists: hasPublication }] = await tx<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = ${PUBLICATION}) AS exists
    `;
    const publicationTables = hasPublication
      ? (
          await tx<{ name: string }[]>`
            SELECT tablename AS name
            FROM pg_publication_tables
            WHERE pubname = ${PUBLICATION} AND schemaname = 'public'
            ORDER BY tablename
          `
        ).map((row) => row.name)
      : null;

    // o cast para regclass lança se a tabela não existe: checar antes
    const [{ exists: hasAuthUsers }] = await tx<{ exists: boolean }[]>`
      SELECT to_regclass('auth.users') IS NOT NULL AS exists
    `;
    const authUserTriggers = hasAuthUsers
      ? await tx<{ name: string; fn: string; enabled: boolean }[]>`
          SELECT t.tgname AS name, p.proname AS fn, t.tgenabled <> 'D' AS enabled
          FROM pg_trigger t
          JOIN pg_proc p ON p.oid = t.tgfoid
          WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
          ORDER BY t.tgname
        `
      : null;

    return {
      readOnly,
      appliedMigrations,
      tables: [...tables],
      policies: [...policies],
      publicationTables,
      authUserTriggers: authUserTriggers && [...authUserTriggers],
    };
  });
}

// Mesmo critério do migrator do drizzle: pendente é toda entrada do journal mais
// nova que a última migration aplicada.
function pendingMigrations(journal: JournalEntry[], applied: number[] | null): JournalEntry[] {
  if (!applied || applied.length === 0) return journal;
  const last = Math.max(...applied);
  return journal.filter((entry) => entry.when > last);
}

function findDrift(journal: JournalEntry[], facts: DbFacts): string[] {
  const drift: string[] = [];

  for (const entry of pendingMigrations(journal, facts.appliedMigrations)) {
    drift.push(`migration nao aplicada: ${entry.tag}`);
  }
  const appliedCount = facts.appliedMigrations?.length ?? 0;
  if (appliedCount !== journal.length) {
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

function printReport(journal: JournalEntry[], facts: DbFacts, drift: string[]) {
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

  console.log(lines.join("\n"));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL nao definida (.env.local)");
    process.exitCode = 2;
    return;
  }

  const journal = readJournal();
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const facts = await collectFacts(sql);
    const drift = findDrift(journal, facts);
    printReport(journal, facts, drift);
    process.exitCode = drift.length === 0 ? 0 : 1;
  } catch (error) {
    console.error("Nao foi possivel checar o banco:", error instanceof Error ? error.message : error);
    process.exitCode = 2;
  } finally {
    await sql.end();
  }
}

void main();

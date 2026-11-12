/**
 * Migration do build de Production (ADR 0004): o `pnpm db:migrate:deploy` roda
 * depois do `next build` e, só no deploy de Production da `main`, aplica as
 * migrations pendentes e confere o banco no modo deploy. Qualquer falha vira
 * `failed`, o script sai com código diferente de 0 e a Vercel não promove o deploy.
 *
 * Recebe uma fábrica de conexão Drizzle, e não uma conexão aberta, porque fora de
 * Production não se conecta a nada. A conexão precisa ser uma sessão só (no
 * postgres-js, `max: 1`): a trava é de sessão e precisa valer para o `migrate()`.
 */

import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect, type PgSession } from "drizzle-orm/pg-core";
// relativo, e não @/, porque o `pnpm db:migrate:deploy` roda este módulo pelo tsx
import {
  MIGRATIONS_FOLDER, checkDatabase, checkFailureReason, readJournal,
  type CheckConnection, type JournalEntry,
} from "./check-database";

export type DeployEnv = {
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  MIGRATION_DATABASE_URL?: string;
};

export type DeployOutcome =
  | { status: "skipped"; reason: string }
  // applied: tags aplicadas por este deploy (vazio se o banco já estava em dia)
  | { status: "migrated"; applied: string[]; report: string }
  | { status: "failed"; reason: string; report?: string };

// Chave fixa do pg_advisory_lock: dois deploys seguidos esperam um pelo outro.
// O valor é arbitrário (#131 + #162); só não pode mudar, senão um deploy com a chave
// antiga e outro com a nova migrariam ao mesmo tempo.
const LOCK_KEY = 131_162;

export async function deployMigrations(
  env: DeployEnv,
  connect: (url: string) => CheckConnection,
  { migrationsFolder = MIGRATIONS_FOLDER }: { migrationsFolder?: string } = {}
): Promise<DeployOutcome> {
  const { VERCEL_ENV, VERCEL_GIT_COMMIT_REF, MIGRATION_DATABASE_URL } = env;
  // Os valores vistos vão no motivo: o log do build mostra que as variáveis chegaram.
  if (VERCEL_ENV !== "production") {
    return {
      status: "skipped",
      reason: `VERCEL_ENV=${VERCEL_ENV ?? "(indefinida)"}: so o deploy de Production migra`,
    };
  }
  if (VERCEL_GIT_COMMIT_REF !== "main") {
    return {
      status: "failed",
      reason:
        `VERCEL_GIT_COMMIT_REF=${VERCEL_GIT_COMMIT_REF ?? "(indefinida)"}: Production so migra ` +
        "a partir da main (promover deploy de Preview nao e suportado)",
    };
  }
  if (!MIGRATION_DATABASE_URL) {
    return {
      status: "failed",
      reason: "MIGRATION_DATABASE_URL nao definida em Production (nao cai para a DATABASE_URL)",
    };
  }

  let db: CheckConnection;
  try {
    db = connect(MIGRATION_DATABASE_URL);
    await db.execute(sql`SELECT pg_advisory_lock(${LOCK_KEY})`);
  } catch (error) {
    return { status: "failed", reason: `nao foi possivel pegar a trava: ${checkFailureReason(error)}` };
  }
  try {
    return await migrateAndCheck(db, migrationsFolder);
  } finally {
    // Um erro aqui (conexão caída) não pode esconder o resultado; a trava de
    // sessão some sozinha quando a conexão fecha.
    await db.execute(sql`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => {});
  }
}

async function migrateAndCheck(db: CheckConnection, migrationsFolder: string): Promise<DeployOutcome> {
  // Cada etapa diz o que falhou: o log do build mostra onde parou.
  let stage = "nao foi possivel ler o journal";
  try {
    const journal = readJournal(migrationsFolder);

    stage = "nao foi possivel conferir o banco antes de migrar";
    const before = await appliedMigrations(db, journal);

    stage = "migration falhou";
    // O mesmo que o migrate() do drizzle-orm/postgres-js e do drizzle-orm/pglite
    // (que só existem por driver): a pasta do repo, a tabela
    // drizzle.__drizzle_migrations e todo o lote pendente numa transação só.
    const config = { migrationsFolder };
    await new PgDialect().migrate(readMigrationFiles(config), db._.session as PgSession, config);

    stage = "nao foi possivel conferir o banco";
    const { facts, drift, report } = await checkDatabase(db, { mode: "deploy", journal });
    if (drift.length > 0) {
      return { status: "failed", reason: `conferencia achou drift (${drift.length})`, report };
    }

    const now = new Set(facts.appliedMigrations ?? []);
    const applied = journal.filter((e) => !before.has(e.when) && now.has(e.when)).map((e) => e.tag);
    return { status: "migrated", applied, report };
  } catch (error) {
    return { status: "failed", reason: `${stage}: ${checkFailureReason(error)}` };
  }
}

// `when` das migrations já gravadas antes deste deploy, para o log dizer o que ele aplicou.
async function appliedMigrations(db: CheckConnection, journal: JournalEntry[]) {
  const { facts } = await checkDatabase(db, { mode: "deploy", journal });
  return new Set(facts.appliedMigrations ?? []);
}

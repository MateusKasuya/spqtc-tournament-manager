/**
 * Migration do build de Production na Vercel (ADR 0004). Roda depois do
 * `next build` pelo `vercel.json`: em Preview e em dev só diz que pulou; no deploy
 * de Production da `main` aplica as migrations pendentes pela
 * MIGRATION_DATABASE_URL (pooler de sessão do Supabase) e confere o banco no modo
 * deploy. A regra mora em src/db/deploy-migrations.ts.
 * Run: pnpm db:migrate:deploy — exit 0 se pulou ou migrou, 1 se falhou.
 * Lê só o process.env (nada de .env.local): produção não se migra à mão.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { deployMigrations } from "../src/db/deploy-migrations";

async function main() {
  const { VERCEL_ENV, VERCEL_GIT_COMMIT_REF, MIGRATION_DATABASE_URL } = process.env;
  const env = { VERCEL_ENV, VERCEL_GIT_COMMIT_REF, MIGRATION_DATABASE_URL };
  let client: postgres.Sql | undefined;
  const outcome = await deployMigrations(env, (url) => {
    // max: 1 — a trava é de sessão: o migrate() precisa rodar na mesma conexão
    client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
    return drizzle(client);
  });
  await client?.end();

  switch (outcome.status) {
    case "skipped":
      console.log(`db:migrate:deploy pulou: ${outcome.reason}`);
      break;
    case "migrated":
      console.log(
        outcome.applied.length > 0
          ? `db:migrate:deploy aplicou: ${outcome.applied.join(", ")}`
          : "db:migrate:deploy: nenhuma migration pendente"
      );
      console.log(outcome.report);
      break;
    case "failed":
      console.error(`db:migrate:deploy FALHOU: ${outcome.reason}`);
      if (outcome.report) console.error(outcome.report);
      process.exitCode = 1;
      break;
  }
}

void main();

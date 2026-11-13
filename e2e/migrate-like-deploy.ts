// Migra o Supabase local pelo mesmo caminho do deploy de Production (ADR 0004):
// o `pnpm db:migrate:deploy` de verdade, sobre postgres-js, com a trava, a
// transação do lote e a conferência no modo deploy. É o que o job e2e do CI usa,
// para que uma atualização do drizzle-orm que quebre esse caminho fique vermelha
// no CI, e não só no build de Production (#170).
// Run: pnpm e2e:migrate:deploy
import { spawnSync } from "node:child_process";
import { localSupabase } from "./support/local-supabase";

const { appEnv } = localSupabase();
const result = spawnSync("pnpm", ["db:migrate:deploy"], {
  stdio: ["ignore", "pipe", "inherit"],
  encoding: "utf8",
  env: {
    ...process.env,
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "main",
    // a URL já passou pela checagem de host local do localSupabase()
    MIGRATION_DATABASE_URL: appEnv.DATABASE_URL,
  },
});
process.stdout.write(result.stdout ?? "");

if (result.status !== 0) process.exit(result.status ?? 1);
// Pular aqui quer dizer que as variáveis não chegaram ao script: o e2e rodaria
// sobre um banco que o caminho do deploy não migrou.
if (result.stdout.includes("db:migrate:deploy pulou")) {
  console.error("e2e:migrate:deploy: o db:migrate:deploy pulou a migration em vez de migrar");
  process.exit(1);
}

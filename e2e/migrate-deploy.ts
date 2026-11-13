// Migra o Supabase local pelo mesmo caminho do deploy de Production (ADR 0004):
// o `pnpm db:migrate:deploy` de verdade, sobre postgres-js, com a trava, a
// transação do lote e a conferência no modo deploy. É o que o job e2e do CI usa,
// para que uma atualização do drizzle-orm que quebre esse caminho fique vermelha
// no CI, e não só no build de Production (#170).
// Run: pnpm e2e:migrate:deploy
import { spawn } from "node:child_process";
import { localSupabase } from "./support/local-supabase";

// O que o db:migrate:deploy imprime quando migrou (aplicou ou já estava em dia).
// Qualquer outra saída com código 0 é um pulo: as variáveis não chegaram e o e2e
// rodaria sobre um banco que esse caminho não migrou. Se a mensagem do script
// mudar, isto falha em vez de deixar passar.
const MIGRATED = ["db:migrate:deploy aplicou:", "db:migrate:deploy: nenhuma migration pendente"];

const { appEnv } = localSupabase();
const child = spawn("pnpm", ["--silent", "db:migrate:deploy"], {
  stdio: ["ignore", "pipe", "inherit"],
  env: {
    ...process.env,
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "main",
    // a URL já passou pela checagem de host local do localSupabase()
    MIGRATION_DATABASE_URL: appEnv.DATABASE_URL,
  },
});

// Repassa a saída enquanto chega: se o deploy demorar na trava, o log do CI mostra onde está.
let stdout = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk: string) => {
  stdout += chunk;
  process.stdout.write(chunk);
});

child.on("close", (status) => {
  if (status !== 0) process.exit(status ?? 1);
  if (!MIGRATED.some((line) => stdout.includes(line))) {
    console.error("e2e:migrate:deploy: o db:migrate:deploy nao migrou (pulou?)");
    process.exit(1);
  }
});

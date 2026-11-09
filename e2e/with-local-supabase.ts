// Roda um comando com o app apontado para o Supabase local:
//   tsx e2e/with-local-supabase.ts drizzle-kit migrate
// As variáveis do `supabase status` vencem as do .env.local (dotenv e Next não
// sobrescrevem o que já está no ambiente).
import { spawnSync } from "node:child_process";
import { localSupabaseEnv } from "./support/local-supabase";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Uso: tsx e2e/with-local-supabase.ts <comando> [args...]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  env: { ...process.env, ...localSupabaseEnv() },
});
process.exit(result.status ?? 1);

import { execFileSync } from "node:child_process";
import { parse } from "dotenv";

export type LocalSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  DATABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

// O setup do e2e apaga tabelas e usuários: nunca pode apontar para produção.
// Por isso as variáveis vêm só do `supabase status`, nunca do .env.local.
function assertLocal(name: string, url: string) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${name} aponta para ${host}; o e2e só roda contra o Supabase local.`);
  }
}

function required(vars: Record<string, string>, name: string) {
  const value = vars[name];
  if (!value) {
    throw new Error(`\`supabase status\` não trouxe ${name}. O Supabase local está rodando? (pnpm supabase:start)`);
  }
  return value;
}

export function localSupabaseEnv(): LocalSupabaseEnv {
  let output: string;
  try {
    output = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Supabase local fora do ar. Suba com `pnpm supabase:start`.");
  }
  const vars = parse(output);

  const env: LocalSupabaseEnv = {
    NEXT_PUBLIC_SUPABASE_URL: required(vars, "API_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required(vars, "ANON_KEY"),
    DATABASE_URL: required(vars, "DB_URL"),
    SUPABASE_SERVICE_ROLE_KEY: required(vars, "SERVICE_ROLE_KEY"),
  };
  assertLocal("API_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  assertLocal("DB_URL", env.DATABASE_URL);
  return env;
}

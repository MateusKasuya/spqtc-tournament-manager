import { execFileSync } from "node:child_process";
import { parse } from "dotenv";

// O que o app (next dev/build/start e drizzle-kit) precisa para falar com o Supabase local.
export type LocalAppEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  DATABASE_URL: string;
};

export type LocalSupabase = {
  appEnv: LocalAppEnv;
  // Só o setup do e2e usa (Admin API); não vai para o processo do app.
  serviceRoleKey: string;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

// O setup do e2e apaga tabelas e usuários: nunca pode apontar para produção.
// Por isso as variáveis vêm só do `supabase status`, nunca do .env.local.
function assertLocal(name: string, url: string) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${name} aponta para ${host}; o e2e so roda contra o Supabase local.`);
  }
}

function requireStatusVar(vars: Record<string, string>, name: string) {
  const value = vars[name];
  if (!value) {
    throw new Error(`\`supabase status\` nao trouxe ${name}. O Supabase local esta rodando? (pnpm supabase:start)`);
  }
  return value;
}

export function localSupabase(): LocalSupabase {
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

  const appEnv: LocalAppEnv = {
    NEXT_PUBLIC_SUPABASE_URL: requireStatusVar(vars, "API_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireStatusVar(vars, "ANON_KEY"),
    DATABASE_URL: requireStatusVar(vars, "DB_URL"),
  };
  assertLocal("API_URL", appEnv.NEXT_PUBLIC_SUPABASE_URL);
  assertLocal("DB_URL", appEnv.DATABASE_URL);
  return { appEnv, serviceRoleKey: requireStatusVar(vars, "SERVICE_ROLE_KEY") };
}

/**
 * Confere o banco de DATABASE_URL (.env.local) contra o que o repo espera, só em
 * leitura: migrations do journal, RLS e policies de public, publicação do Realtime
 * e o trigger de auth.users. A conferência mora em src/db/check-database.ts, aqui
 * no modo manual (banco à frente do journal é drift).
 * Run: pnpm db:check — exit 0 sem drift, 1 com drift, 2 se não conseguiu checar.
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { checkDatabase, checkFailureReason, readJournal } from "../src/db/check-database";

config({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL nao definida (.env.local)");
    process.exitCode = 2;
    return;
  }

  const journal = readJournal();
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const { drift, report } = await checkDatabase(drizzle(client), { mode: "manual", journal });
    console.log(report);
    process.exitCode = drift.length === 0 ? 0 : 1;
  } catch (error) {
    console.error("Nao foi possivel checar o banco:", checkFailureReason(error));
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

void main();

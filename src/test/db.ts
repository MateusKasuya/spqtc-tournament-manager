import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as schema from "@/db/schema";

export const pg = new PGlite();
export const testDb = drizzle(pg, { schema });

// Schema de teste gerado do schema TS (fonte única de verdade) com
// `pnpm test:schema` (drizzle-kit export). As migrations replicam do zero
// (a partir de drizzle/migrations/0000_baseline.sql), mas aqui aplicamos o DDL
// consolidado direto por velocidade e isolamento. Regenere com
// `pnpm test:schema` sempre que o schema TS mudar.
const schemaSql = readFileSync(
  fileURLToPath(new URL("./schema.sql", import.meta.url)),
  "utf8"
);

export async function migrateTestDb() {
  await pg.exec(schemaSql);
}

export async function resetTestDb() {
  await testDb.execute(sql`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;`);
}

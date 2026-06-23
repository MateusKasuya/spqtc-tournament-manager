import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

export const pg = new PGlite();
export const testDb = drizzle(pg, { schema });

export async function migrateTestDb() {
  await migrate(testDb, { migrationsFolder: "./src/test/migrations" });
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

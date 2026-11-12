import { PGlite } from "@electric-sql/pglite";

// pglite "parecido com Supabase": papéis anon/authenticated, schema auth com
// auth.uid() e uma auth.users mínima, e a publicação supabase_realtime (vazia,
// como no Supabase antes das migrations). As migrations que só agem no Supabase
// (RLS, Realtime, trigger de auth) agem aqui também.
export async function supabaseLikePg() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE PUBLICATION supabase_realtime;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated;
  `);
  return pg;
}

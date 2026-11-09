-- Liga RLS em todas as tabelas de public. A escrita é só pelo servidor (Drizzle,
-- dono das tabelas); pelo cliente do Supabase o app só lê:
-- - users: o próprio perfil (getProfile, requireAdmin);
-- - tournaments, participants, blind_structures, prize_structures: a mesa ao vivo
--   (Realtime respeita RLS) para quem está logado.
-- Fica fora do schema TS de propósito: as policies dependem dos papéis e do schema
-- auth do Supabase, que o pglite dos testes não tem.
-- Idempotente e só no Supabase (fora dele, no-op).
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;

    DROP POLICY IF EXISTS "users_select_own" ON public.users;
    CREATE POLICY "users_select_own" ON public.users
      FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

    FOREACH t IN ARRAY ARRAY['tournaments', 'participants', 'blind_structures', 'prize_structures'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_authenticated', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
        t || '_select_authenticated', t
      );
    END LOOP;
  END IF;
END $$;

-- Configuração do Supabase que até aqui vivia só no painel de produção (ADR 0003):
-- 1. o trigger on_auth_user_created -> handle_new_user(), que cria o perfil em
--    public.users no cadastro (name do metadata "name" ou a parte antes do @);
-- 2. tournaments e participants na publicação supabase_realtime (Mesa ao vivo).
-- Idempotente e só no Supabase (fora dele, no-op). Onde a função ou o trigger já
-- existem (produção), nada é recriado.
DO $$
DECLARE
  t text;
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF to_regprocedure('public.handle_new_user()') IS NULL THEN
      EXECUTE $fn$
        CREATE FUNCTION public.handle_new_user()
        RETURNS trigger AS $body$
        BEGIN
          INSERT INTO public.users (id, email, name)
          VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
          );
          RETURN NEW;
        END;
        $body$ LANGUAGE plpgsql SECURITY DEFINER
      $fn$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass
    ) THEN
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['tournaments', 'participants'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

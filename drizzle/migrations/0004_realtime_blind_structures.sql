-- A mesa ao vivo assina mudanças na estrutura de blinds (Níveis ao vivo, #59).
-- Idempotente e só onde a publicação do Supabase existe (fora do Supabase, no-op).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'blind_structures'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blind_structures;
  END IF;
END $$;

-- A mesa ao vivo assina mudanças na Estrutura de prêmios (Painéis da mesa, #83).
-- Idempotente e só onde a publicação do Supabase existe (fora do Supabase, no-op).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'prize_structures'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prize_structures;
  END IF;
END $$;

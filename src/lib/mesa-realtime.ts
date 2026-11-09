// Tabelas que a Mesa ao vivo assina pelo Realtime do Supabase. Fonte única: o hook
// da mesa monta o canal daqui e o `pnpm db:check` confere que todas estão na
// publicação `supabase_realtime`.

// Tabelas cuja mudança dispara nova busca da parte ao vivo.
// Editar a Estrutura de prêmios apaga e reinsere as posições: as inserções disparam
// a busca. Limpar a Estrutura só apaga, e o realtime pode não entregar apagamentos a
// um canal filtrado por torneio; aí a mesa só vê a limpeza no próximo evento.
export const MESA_LIVE_TABLES = ["participants", "blind_structures", "prize_structures"] as const;

// O UPDATE do torneio é aplicado direto do evento; as demais disparam nova busca.
export const MESA_REALTIME_TABLES = ["tournaments", ...MESA_LIVE_TABLES] as const;

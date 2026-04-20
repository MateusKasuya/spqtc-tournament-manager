# Análise de Performance — Tournament Manager

## Contexto

A aplicação está lenta, **principalmente nos momentos de CRUD com o banco** (adicionar buy-in, rebuy, eliminar jogador, etc.). Este documento mapeia os gargalos reais e propõe um roadmap em 8 fases, cada uma detalhada em seu próprio arquivo.

**Ordem executiva recomendada:** `0 → B → C → G → A → D → E → F`.

A ordem foi escolhida para atacar o sintoma "CRUD trava" primeiro (redução de trabalho por clique), deixando otimizações infraestruturais para depois.

---

## Índice das Fases

| Fase | Arquivo | Tema | Prioridade |
|------|---------|------|-----------|
| 0 | [perf_phase_0_medir.md](./perf_phase_0_medir.md) | Medir antes de mexer | 🔬 primeiro |
| B | [perf_phase_b_revalidacao.md](./perf_phase_b_revalidacao.md) | Invalidação seletiva de cache | 🔴 crítica |
| C | [perf_phase_c_optimistic.md](./perf_phase_c_optimistic.md) | Optimistic UI | 🔴 crítica |
| G | [perf_phase_g_debounce.md](./perf_phase_g_debounce.md) | Debounce do realtime | 🔴 crítica |
| A | [perf_phase_a_indices.md](./perf_phase_a_indices.md) | Índices no banco | 🟠 alta |
| D | [perf_phase_d_suspense.md](./perf_phase_d_suspense.md) | Suspense + streaming | 🟡 média |
| E | [perf_phase_e_queries.md](./perf_phase_e_queries.md) | Colapsar queries sequenciais | 🟡 média |
| F | [perf_phase_f_pool.md](./perf_phase_f_pool.md) | Pool de conexão | 🟡 média |

---

## Diagnóstico — Top 8 Gargalos

### 1. 🟠 ALTO — Índices faltando em colunas "quentes"

Ressalva: `participants` já tem `unique(tournamentId, playerId)` em `src/db/schema/participants.ts:29`, que funciona como índice composto para filtros por `tournament_id` (leftmost prefix). Não precisa índice novo nessa coluna.

Colunas que de fato precisam de índice:
- `participants.player_id`
- `transactions(tournament_id)`
- `transactions(tournament_id, created_at)`
- `transactions.player_id`
- `blind_structures.tournament_id`
- `tournaments.season_id`

**Impacto:** Cresce com o tempo. Se tabelas são pequenas hoje, ganho imediato é modesto.

### 2. 🔴 CRÍTICO — `revalidatePath(..., "layout")` em cascata

`src/actions/participants.ts` tem 16+ ocorrências. Cada clique invalida o layout inteiro, forçando re-execução das **9 queries paralelas** em `src/app/(dashboard)/torneios/[id]/page.tsx:40-50`, inclusive dados imutáveis (profile, config, blind levels).

**Impacto:** 1 mutação pequena = 9 queries. Principal ofensor do sintoma "CRUD trava".

### 3. 🔴 CRÍTICO — `router.refresh()` + Realtime duplicam refresh

`src/components/live-table/quick-actions.tsx:218`, `src/hooks/use-participants-realtime.ts:24`. Após uma ação, `router.refresh()` roda localmente **e** o Realtime detecta a mudança e chama outro `router.refresh()`. Cliques rápidos empilham refreshes em fila.

### 4. 🟠 ALTO — Loops sequenciais em bounties

`src/actions/participants.ts:198-209, 288-299, 443-454, 728-737`. Updates sequenciais dentro de loop escalam mal no modo bounty (migration 0012).

### 5. 🟠 ALTO — Ausência de `useOptimistic`

`src/components/live-table/quick-actions.tsx`, `src/components/tournament/participant-list.tsx`, `payout-dialog.tsx`. UI espera round-trip completo antes de atualizar. Até ações rápidas parecem lentas.

### 6. 🟡 MÉDIO — Queries sequenciais dentro de uma mesma action

`src/actions/participants.ts:144-232` (`addRebuy`). 4 round-trips numa única "mutação".

### 7. 🟡 MÉDIO — 9 queries em `Promise.all` sem `Suspense`

`src/app/(dashboard)/torneios/[id]/page.tsx:40-50`. Página só renderiza depois da query mais lenta. Sem streaming.

### 8. 🟡 MÉDIO — Pool de conexão `max: 1`

`src/db/index.ts:13`. Padrão para serverless, mas serializa queries dentro de uma mesma invocação. Validar ambiente de deploy antes de mudar.

---

## Como medir ganho entre fases

Após cada fase executada:
1. Repetir os passos 3–5 da Fase 0 (network, console.time, teste de stress).
2. Comparar com o baseline em `docs/perf_baseline.md`.
3. Se o ganho foi menor que esperado, revisar antes de partir pra próxima fase.

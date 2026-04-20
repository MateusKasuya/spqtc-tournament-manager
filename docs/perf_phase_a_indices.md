# Fase A — Índices no banco

**Objetivo:** Prevenir degradação de queries conforme tabelas crescem. Ganho imediato depende do tamanho atual do banco (medido na Fase 0).

**Pré-requisito:** Fase 0. Idealmente já com cache + realtime resolvidos (B, C, G) — assim o impacto dos índices fica mais visível no que sobrou.

---

## Ressalva importante

`participants` já tem `unique(tournamentId, playerId)` em `src/db/schema/participants.ts:29`. Postgres usa esse índice composto também para filtros só por `tournament_id` (leftmost prefix matching). Ou seja, **não criar** um índice novo em `participants(tournament_id)` — seria redundante.

---

## Migration a criar

Rodar `npx drizzle-kit generate` depois de atualizar os schemas. O SQL gerado deve ser equivalente a:

```sql
CREATE INDEX IF NOT EXISTS idx_participants_player_id
  ON participants(player_id);

CREATE INDEX IF NOT EXISTS idx_transactions_tournament_id
  ON transactions(tournament_id);

CREATE INDEX IF NOT EXISTS idx_transactions_player_id
  ON transactions(player_id);

CREATE INDEX IF NOT EXISTS idx_transactions_tournament_created
  ON transactions(tournament_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blind_structures_tournament_id
  ON blind_structures(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_season_id
  ON tournaments(season_id);
```

---

## Atualizar schemas Drizzle

### `src/db/schema/participants.ts`

```ts
import { pgTable, serial, integer, text, boolean, timestamp, numeric, unique, jsonb, index } from "drizzle-orm/pg-core";

export const participants = pgTable("participants", {
  // ... colunas existentes
}, (table) => [
  unique().on(table.tournamentId, table.playerId),
  index("idx_participants_player_id").on(table.playerId),
]);
```

### `src/db/schema/transactions.ts`

```ts
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const transactions = pgTable("transactions", {
  // ... colunas existentes
}, (table) => [
  index("idx_transactions_tournament_id").on(table.tournamentId),
  index("idx_transactions_player_id").on(table.playerId),
  index("idx_transactions_tournament_created").on(table.tournamentId, table.createdAt.desc()),
]);
```

### `src/db/schema/blind_structures.ts`

```ts
// ... adicionar no array de constraints/indexes:
index("idx_blind_structures_tournament_id").on(table.tournamentId),
```

### `src/db/schema/tournaments.ts`

```ts
// ... adicionar:
index("idx_tournaments_season_id").on(table.seasonId),
```

---

## Passos

1. Atualizar os 4 arquivos de schema acima.
2. Rodar `npx drizzle-kit generate` — vai criar `drizzle/migrations/00XX_*.sql`.
3. **Revisar** o SQL gerado antes de aplicar. Confirmar que são todos `CREATE INDEX IF NOT EXISTS` e que não há drops inesperados.
4. Aplicar em dev: `npx drizzle-kit migrate`.
5. Conferir no Supabase Dashboard → Database → Indexes que os 6 índices novos apareceram.
6. **Teste de regressão:** rodar a suite (se existir) ou testar manualmente os fluxos principais — adicionar participante, rebuy, eliminar, undo. Índices novos não devem quebrar nada, mas a migration pode ter artefatos.
7. Deploy pra prod.

---

## Consideração sobre tabelas grandes

`CREATE INDEX` trava writes na tabela durante a criação. Em tabelas pequenas (<10k linhas, que é provavelmente o caso hoje), é instantâneo. Se as tabelas forem grandes ou a criação em prod precisar ser non-blocking, usar `CREATE INDEX CONCURRENTLY` **manualmente** (Drizzle não gera isso automaticamente):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_tournament_created
  ON transactions(tournament_id, created_at DESC);
```

`CONCURRENTLY` não pode rodar dentro de transaction — em Drizzle, isso significa rodar a migration manualmente via `psql` ou Supabase SQL editor.

---

## Verificação

No Supabase SQL editor:

```sql
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE tournament_id = 1
ORDER BY created_at DESC
LIMIT 10;
```

- **Antes:** `Seq Scan on transactions` + `Sort`.
- **Depois:** `Index Scan using idx_transactions_tournament_created`.

Repetir para:

```sql
EXPLAIN ANALYZE SELECT * FROM participants WHERE player_id = 1;
EXPLAIN ANALYZE SELECT * FROM blind_structures WHERE tournament_id = 1 ORDER BY level_number;
EXPLAIN ANALYZE SELECT * FROM tournaments WHERE season_id = 1;
```

---

## Riscos

- **Gasto de disco:** cada índice ocupa espaço. Para 6 índices em tabelas de poucos milhares de linhas, é desprezível.
- **Custo de write:** INSERT/UPDATE atualizam os índices. Em workload de torneio (alguns INSERTs por minuto), o custo é invisível.
- **Índice "em excesso":** se uma coluna tem baixa seletividade (poucos valores distintos), Postgres ignora o índice. `player_id` e `tournament_id` são boas candidatas (alta cardinalidade). Se o `EXPLAIN ANALYZE` mostrar que o índice não está sendo usado, vale remover.

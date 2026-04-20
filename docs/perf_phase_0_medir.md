# Fase 0 — Medir antes de mexer

**Objetivo:** Confirmar qual gargalo domina na realidade, antes de investir esforço em mudança de código.

**Duração estimada:** 30–60 min. Zero código de aplicação.

**Pré-requisito:** Acesso ao Supabase Dashboard do projeto.

---

## Passos

### 1. Supabase Dashboard — Query Performance

- Login → Dashboard do projeto → Database → Query Performance.
- Filtrar pelas últimas 24h. Anotar:
  - Top 5 queries por **tempo total** (`total_exec_time` — tempo médio × chamadas).
  - Top 5 queries por **frequência** (`calls`).
  - Existe alguma query com `Seq Scan` em tabela grande? (ver `EXPLAIN` ou coluna "command").
- Tirar screenshot da tabela para referência.

### 2. Tamanho das tabelas

No SQL editor do Supabase, rodar:

```sql
SELECT
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_live_tup as rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

Anotar contagem de linhas em `participants`, `transactions`, `tournaments`, `blind_structures`.

### 3. Medir latência ponta-a-ponta no cliente

- Abrir o app (`npm run dev`), aba Network do DevTools → filtro "Fetch/XHR".
- Limpar o log. Fluxo padrão: abrir torneio ativo → clicar "Confirmar buy-in" → observar:
  - Quantas requisições RSC/POST são feitas por clique? (deveria ser ~1 POST + 1 RSC; mais que isso é cascata).
  - Tempo da Server Action (coluna "Timing" → "Waiting TTFB").
  - Tempo do RSC payload seguinte.
- Repetir para: rebuy, add-on, eliminar jogador, undo.

### 4. Medir lado servidor com `console.time`

Em `src/actions/participants.ts`, adicionar temporariamente logs:

```ts
export async function confirmBuyIn(participantId: number) {
  console.time(`confirmBuyIn-${participantId}`);
  try {
    // ...lógica existente...
  } finally {
    console.timeEnd(`confirmBuyIn-${participantId}`);
  }
}
```

Em `src/app/(dashboard)/torneios/[id]/page.tsx`, medir o `Promise.all`:

```ts
console.time("torneio-page-queries");
const [...] = await Promise.all([...]);
console.timeEnd("torneio-page-queries");
```

Rodar o fluxo duas vezes e capturar os tempos no terminal.

**Importante:** esses logs são temporários. Lembrar de remover antes do commit final ou deixar um TODO visível.

### 5. Teste de stress manual

- Adicionar 10 participantes em sequência rápida.
- Eliminar 5 jogadores rápido. Observar se a UI congela.
- Anotar tempo total percebido e descrição da sensação ("congela por 3s", "botão não responde", etc.).

---

## Entregável

Criar `docs/perf_baseline.md` com:

```markdown
# Baseline de Performance — YYYY-MM-DD

## Banco
- participants: N linhas
- transactions: N linhas
- tournaments: N linhas
- blind_structures: N linhas

## Top queries (por tempo total)
1. query X — Yms médio × Z calls = Wms total
2. ...

## Latência por ação CRUD (lado servidor)
- confirmBuyIn: Xms
- addRebuy: Xms
- eliminatePlayer: Xms
- undoRebuy: Xms

## Round-trips por clique (Network tab)
- confirmBuyIn: N requests (1 POST + N-1 RSC)
- ...

## Sensação no stress test
- 10 participantes em sequência: Xs total, UI congelou? (s/n)
- 5 eliminações rápidas: Xs total
```

---

## Decisão pós-medição

Com esses números, revisar a ordem do roadmap:

- Se `participants`/`transactions` têm **<1k linhas** e nenhuma query aparece como "Seq Scan" significativa → **Fase A pode ir pro fim** do roadmap.
- Se cada clique dispara **3+ refreshes** visíveis na Network → **Fases B + G entram primeiro**.
- Se `confirmBuyIn` server-side é <100ms mas UI responde em >1s → o gargalo é **client-side** (cascata de revalidação) → **Fases B + C primeiro**.
- Se `confirmBuyIn` server-side é >500ms → gargalo é **banco/query** → **Fases A + E primeiro**.

# Fase 6 — Polish & Deploy

## Objetivo

Corrigir erros de build, resolver problemas de performance, melhorar UX geral, preparar para producao e fazer deploy na Vercel com dominio customizado.

---

## Etapa 1: Performance e correcoes criticas

### 1.0 Race condition ao finalizar torneio

**Arquivo:** `src/actions/tournaments.ts` (updateTournamentStatus → "finished")

**Problema:** Se dois admins clicam "Finalizar" ao mesmo tempo, o loop de calculo de pontos roda em duplicidade, podendo atribuir pontos 2x.

**Correcao:** Envolver a transicao para `finished` em uma database transaction e adicionar check de idempotencia (verificar se status ja eh `finished` antes de prosseguir):

```typescript
await db.transaction(async (tx) => {
  const [current] = await tx.select({ status: tournaments.status })
    .from(tournaments).where(eq(tournaments.id, tournamentId));
  if (current.status === "finished") return; // idempotente

  await tx.update(tournaments).set({ status: "finished" })...
  // calcular e atribuir pontos dentro da mesma transaction
});
```

### 1.1 `distributePayouts()` — batch em vez de loop

**Arquivo:** `src/actions/participants.ts` (linhas ~244-275)

**Problema:** Loop faz 2 queries por jogador premiado (INSERT transaction + UPDATE participant). Para 10 jogadores = 20 queries.

**Correcao:** Usar batch insert para transactions e batch update para participants:

```typescript
// Batch insert de todas as transactions
const transactionValues = payouts
  .filter(p => p.amount > 0)
  .map(p => ({ tournamentId, playerId: p.playerId, type: "prize", amount: p.amount }));

if (transactionValues.length > 0) {
  await db.insert(transactions).values(transactionValues);
}

// Batch update de prize_amount nos participants (1 query com CASE WHEN ou Promise.all)
await Promise.all(payouts.map(p =>
  db.update(participants)
    .set({ prizeAmount: p.amount, finishPosition: p.position })
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.playerId, p.playerId)))
));
```

### 1.2 `eliminatePlayer()` — usar transaction

**Arquivo:** `src/actions/participants.ts` (linhas ~165-211)

**Problema:** 5 queries sequenciais sem transaction. Se uma falha no meio, estado fica inconsistente.

**Correcao:** Envolver todas as operacoes em `db.transaction()`.

### 1.3 Bug do timer `useCountdown` — closure stale

**Arquivo:** `src/hooks/use-countdown.ts` (linhas ~35-36)

**Problema:** `computeRemaining(timer)` dentro do `setInterval` captura o valor de `timer` do momento em que o interval foi criado. Quando `timer` muda via realtime, o interval continua usando o valor antigo ate ser recriado.

**Correcao:** Usar ref para armazenar o timer state mais recente:

```typescript
const timerRef = useRef(timer);
useEffect(() => { timerRef.current = timer; }, [timer]);

// No interval:
const remaining = computeRemaining(timerRef.current);
```

### 1.4 Remover polling desnecessario em `MesaAoVivo`

**Arquivo:** `src/components/live-table/mesa-ao-vivo.tsx` (linhas ~88-92)

**Problema:** `router.refresh()` a cada 5 segundos como fallback do realtime, mas o realtime ja funciona. Dobra a carga no servidor durante torneios ativos.

**Correcao:** Remover o `setInterval` de fallback. Se necessario manter fallback, usar intervalo de 30-60 segundos com backoff.

### 1.5 `advanceBlindLevel` — query otimizada

**Arquivo:** `src/actions/tournaments.ts` (linhas ~290-327)

**Problema:** Busca TODOS os blind levels e faz `findIndex` no JS para achar o proximo.

**Correcao:** Buscar direto o proximo nivel no banco:

```typescript
const [nextLevel] = await db.select()
  .from(blindStructures)
  .where(and(
    eq(blindStructures.tournamentId, tournamentId),
    gt(blindStructures.level, currentLevel)
  ))
  .orderBy(asc(blindStructures.level))
  .limit(1);
```

### 1.6 Caching com `unstable_cache` para queries pesadas

**Arquivos:** `src/db/queries/ranking.ts`, `src/db/queries/players.ts`

**Problema:** Ranking page recalcula todas as agregacoes (SUM, COUNT, GROUP BY) no banco a cada page load. Para o ranking, os dados so mudam quando um torneio termina.

**Correcao:** Envolver queries de leitura pesada em `unstable_cache`:

```typescript
import { unstable_cache } from "next/cache";

export const getSeasonRanking = unstable_cache(
  async (seasonId: number) => {
    return db.select(...)...
  },
  ["season-ranking"],
  { revalidate: 60, tags: ["ranking"] }
);
```

E usar `revalidateTag("ranking")` quando um torneio eh finalizado.

Queries candidatas ao cache:
- `getSeasonRanking()` — revalidate 60s + tag "ranking"
- `getSeasonPointsByTournament()` — revalidate 60s + tag "ranking"
- `getAllPlayers()` — revalidate 300s + tag "players"
- `getSeasons()` — revalidate 300s + tag "seasons"

### 1.7 Otimizar logo.png (279KB)

**Arquivo:** `public/logo.png`

**Problema:** PNG de 279KB carregado em toda pagina sem otimizacao.

**Correcao:**
1. Converter para WebP (~30-40KB)
2. Usar `<Image>` do Next.js com `sizes` e `priority` no layout
3. Remover assets nao usados (`file.svg`, `next.svg`, `vercel.svg`, `window.svg`)

### 1.8 Parallelizar fetches na pagina de ranking

**Arquivo:** `src/app/(dashboard)/ranking/page.tsx` (linhas ~19-41)

**Problema:** Dois `Promise.all` sequenciais — primeiro busca seasons, depois busca ranking. Poderia ser um unico `Promise.all`.

**Correcao:** Buscar tudo em paralelo passando seasonId como default da temporada ativa (se disponivel).

---

## Etapa 2: Corrigir erros de build (lint)

O build atual falha por 4 erros de ESLint (`react/no-unescaped-entities`).

### 2.1 Corrigir `src/app/(dashboard)/jogadores/page.tsx` (linha 30)

Substituir `"` por `&quot;` ou usar template literals nos textos que contem aspas.

### 2.2 Corrigir `src/components/tournament/payout-dialog.tsx` (linha 122)

Mesmo problema — escapar aspas no JSX.

### 2.3 Limpar warnings de imports nao usados

Remover imports nao utilizados em:
- `src/app/(dashboard)/dashboard/page.tsx` — `Medal`
- `src/components/live-table/quick-actions.tsx` — `ParticipantRow`
- `src/components/tournament/add-participant-dialog.tsx` — `Label`
- `src/components/tournament/tournament-status-button.tsx` — `XCircle`
- `src/db/queries/ranking.ts` — `transactions`
- `src/lib/tournament-defaults.ts` — `_playerCount`

### 2.4 Validar build limpo

Rodar `npm run build` e confirmar zero erros e zero warnings.

---

## Etapa 3: Loading states e error boundaries

### 3.1 Criar `loading.tsx` para rotas principais

Adicionar skeletons de carregamento para:
- `src/app/(dashboard)/dashboard/loading.tsx`
- `src/app/(dashboard)/torneios/loading.tsx`
- `src/app/(dashboard)/ranking/loading.tsx`
- `src/app/(dashboard)/jogadores/loading.tsx`

Usar componente skeleton do shadcn/ui para manter consistencia visual.

### 3.2 Criar `error.tsx` para rotas principais

Adicionar error boundaries com botao "Tentar novamente" para:
- `src/app/(dashboard)/torneios/[id]/error.tsx`
- `src/app/(dashboard)/error.tsx` (fallback geral do dashboard)

### 3.3 Criar `not-found.tsx` global

Pagina 404 customizada em `src/app/not-found.tsx` com link para o dashboard.

---

## Etapa 4: Melhorias de UX

### 4.1 Empty states

Revisar e garantir que todas as listas tenham estados vazios adequados:
- Lista de torneios sem torneios criados
- Ranking sem torneios finalizados na temporada
- Perfil do jogador sem historico
- Participantes de um torneio vazio

### 4.2 Confirmacoes de acoes destrutivas

Verificar que acoes criticas pedem confirmacao:
- Eliminar jogador
- Cancelar torneio
- Deletar torneio

### 4.3 Feedback visual de acoes (toasts)

Verificar que todas as server actions mostram feedback via toast:
- Sucesso: "Torneio criado", "Jogador eliminado", etc.
- Erro: mensagem descritiva do problema

### 4.4 Responsividade

Testar e ajustar layout em telas pequenas (360px-414px):
- Sidebar deve ser colapsavel/drawer no mobile
- Tabelas de ranking com scroll horizontal
- Cards de stats empilhados no mobile
- Timer/blinds display legiveis no mobile

---

## Etapa 5: Seguranca e protecao

### 5.1 Revisar RLS no Supabase

Confirmar que todas as tabelas tem Row Level Security ativado e policies corretas:
- `users/players`: leitura para todos autenticados, escrita so admin
- `tournaments`: leitura para todos, escrita so admin
- `participants`: leitura para todos, escrita so admin
- `transactions`: leitura para todos, escrita so admin
- `seasons`: leitura para todos, escrita so admin

### 5.2 Verificar `requireAdmin` em todas as server actions de escrita

Garantir que `createTournament`, `updateTournament`, `eliminatePlayer`, `createSeason`, etc. verificam role admin.

### 5.3 Validar middleware de auth

O middleware atual (`src/middleware.ts`) ja redireciona para `/login` se nao autenticado. Verificar que:
- A rota `/` redireciona para `/dashboard`
- Assets estaticos nao passam pelo middleware (ja configurado no matcher)

### 5.4 Rate limiting (opcional)

Considerar adicionar rate limiting nas server actions via Supabase ou middleware se necessario. Baixa prioridade para grupo pequeno.

---

## Etapa 6: Deploy na Vercel

### 6.1 Preparar projeto para Vercel

1. Garantir que `next.config.ts` nao tem configuracoes conflitantes
2. Verificar que todas as env vars estao documentadas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (se usado em server actions)
   - `DATABASE_URL` (connection string do Supabase para Drizzle)

### 6.2 Deploy inicial

```bash
# Instalar Vercel CLI (se nao instalado)
npm i -g vercel

# Login e deploy
vercel login
vercel --prod
```

Ou conectar o repositorio GitHub na dashboard da Vercel para deploy automatico.

### 6.3 Configurar variaveis de ambiente na Vercel

Na dashboard da Vercel, adicionar todas as env vars listadas em 6.1.

### 6.4 Configurar dominio customizado

1. Comprar/configurar dominio (ex: spqc.com.br ou similar)
2. Na Vercel: Settings → Domains → Add domain
3. Configurar DNS (CNAME ou nameservers da Vercel)
4. SSL automatico pela Vercel

### 6.5 Testar deploy

- Login/logout funciona
- Criar torneio completo (criar → adicionar jogadores → iniciar → timer → eliminar → finalizar)
- Ranking atualiza corretamente
- Realtime funciona entre dispositivos diferentes
- Mobile layout OK

---

## Etapa 7: Ajustes pos-deploy

### 7.1 Configurar Supabase Auth para producao

- Adicionar dominio de producao nos "Site URL" e "Redirect URLs" do Supabase Auth (Authentication → URL Configuration)
- Sem isso, login via magic link/OAuth nao funciona no dominio de producao

### 7.2 Monitoramento basico

- Vercel Analytics (gratuito, built-in) — ativar na dashboard
- Supabase dashboard para monitorar uso do banco

### 7.3 Supabase Free Tier — limitacoes e cuidados

O projeto usa o plano gratuito do Supabase. Limites relevantes:
- **500MB** de banco — mais que suficiente para o SPQC
- **1GB** de storage — sem uso atual
- **200 conexoes simultâneas** de realtime — sobra
- **Sem backups automaticos** — backups sao feature do plano Pro
- **Pausa apos 7 dias de inatividade** — primeiro acesso apos pausa demora alguns segundos

**Backup manual:** como nao tem backup automatico no free, exportar os dados periodicamente via `pg_dump` ou pelo dashboard do Supabase (Database → Backups nao disponivel, usar SQL Editor → Export). Fazer isso antes de cada temporada nova, no minimo.

**Pausa por inatividade:** se o grupo ficar mais de 1 semana sem acessar, o projeto pausa. Basta acessar o app ou o dashboard do Supabase para reativar. Para evitar, um cron job simples pode pingar o app periodicamente (baixa prioridade).

---

## Resumo de arquivos

### Novos
| Arquivo | Descricao |
|---------|-----------|
| `src/app/(dashboard)/dashboard/loading.tsx` | Skeleton de loading do dashboard |
| `src/app/(dashboard)/torneios/loading.tsx` | Skeleton de loading de torneios |
| `src/app/(dashboard)/ranking/loading.tsx` | Skeleton de loading do ranking |
| `src/app/(dashboard)/jogadores/loading.tsx` | Skeleton de loading de jogadores |
| `src/app/(dashboard)/error.tsx` | Error boundary geral do dashboard |
| `src/app/(dashboard)/torneios/[id]/error.tsx` | Error boundary do torneio |
| `src/app/not-found.tsx` | Pagina 404 customizada |

### Modificados
| Arquivo | Mudanca |
|---------|---------|
| `src/actions/tournaments.ts` | Transaction no finish + query otimizada de blinds + cache tags |
| `src/actions/participants.ts` | Transaction no eliminate + batch no distributePayouts |
| `src/hooks/use-countdown.ts` | Fix closure stale do timer (usar ref) |
| `src/components/live-table/mesa-ao-vivo.tsx` | Remover polling fallback de 5s |
| `src/db/queries/ranking.ts` | Envolver em unstable_cache + remover import `transactions` |
| `src/db/queries/players.ts` | Envolver getAllPlayers em unstable_cache |
| `src/app/(dashboard)/ranking/page.tsx` | Parallelizar fetches em unico Promise.all |
| `src/app/(dashboard)/jogadores/page.tsx` | Fix lint: escapar aspas |
| `src/components/tournament/payout-dialog.tsx` | Fix lint: escapar aspas |
| `src/app/(dashboard)/dashboard/page.tsx` | Remover import `Medal` nao usado |
| `src/components/live-table/quick-actions.tsx` | Remover import `ParticipantRow` |
| `src/components/tournament/add-participant-dialog.tsx` | Remover import `Label` |
| `src/components/tournament/tournament-status-button.tsx` | Remover import `XCircle` |
| `src/lib/tournament-defaults.ts` | Remover parametro `_playerCount` |
| `src/app/layout.tsx` | Image otimizada para logo |
| `public/logo.png` | Converter para WebP |

---

## Ordem de execucao sugerida

1. **Etapa 1**: Performance e correcoes criticas (race conditions, transactions, timer bug, caching)
2. **Etapa 2**: Corrigir erros de build (bloqueante para deploy)
3. **Etapa 3**: Loading states e error boundaries
4. **Etapa 4**: Melhorias de UX (empty states, confirmacoes, responsividade)
5. **Etapa 5**: Revisao de seguranca
6. **Etapa 6**: Deploy na Vercel
7. **Etapa 7**: Ajustes pos-deploy

---

## Dependencias

- Etapa 1 eh a mais importante — corrige bugs que afetam integridade dos dados (pontos duplicados, timer errado)
- Etapa 2 eh pre-requisito para deploy (build precisa passar)
- Etapas 3-5 sao independentes entre si e podem ser feitas em qualquer ordem
- Etapa 6 depende de todas as anteriores estarem prontas
- Etapa 7 depende do deploy estar no ar

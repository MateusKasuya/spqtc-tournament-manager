# Fase 3 — Participantes & Financeiro

## Visao geral

Esta fase implementa o gerenciamento de jogadores dentro de cada torneio e o controle financeiro completo. Introduz duas novas tabelas (`participants` e `transactions`) e reestrutura o fluxo de resultados para vincular jogadores reais em vez de apenas posicoes anonimas.

**O que muda em relacao ao estado atual:**
- A tabela `tournament_results` (posicao + valor sem vinculo com jogador) sera substituida pela tabela `participants`, que vincula user_id ao torneio e carrega posicao final, premio, rebuys, etc.
- A tabela `transactions` cria um log financeiro auditavel (buy-in, rebuy, addon, premio pago).

---

## Step 1: Schemas do banco (Drizzle)

### 1a. `src/db/schema/participants.ts`

```typescript
import { pgTable, serial, integer, text, boolean, timestamp, uuid, numeric, unique } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";
import { users } from "./users";

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  buyInPaid: boolean("buy_in_paid").notNull().default(false),
  rebuyCount: integer("rebuy_count").notNull().default(0),
  addonUsed: boolean("addon_used").notNull().default(false),
  finishPosition: integer("finish_position"), // 1 = campeao
  pointsEarned: numeric("points_earned", { precision: 10, scale: 2 }).notNull().default("0"),
  prizeAmount: integer("prize_amount").notNull().default(0), // centavos
  eliminatedAt: timestamp("eliminated_at", { withTimezone: true }),
  status: text("status", {
    enum: ["registered", "playing", "eliminated", "finished"],
  }).notNull().default("registered"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.tournamentId, table.userId),
]);
```

### 1b. `src/db/schema/transactions.ts`

```typescript
import { pgTable, serial, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";
import { users } from "./users";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  type: text("type", {
    enum: ["buy_in", "rebuy", "addon", "prize"],
  }).notNull(),
  amount: integer("amount").notNull(), // centavos
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 1c. Atualizar `src/db/schema/index.ts`

Adicionar exports para `participants` e `transactions`. Remover export de `tournamentResults`.

### 1d. Migration

Rodar `npx drizzle-kit generate` + `npx drizzle-kit push` para criar as tabelas. Depois, remover a tabela `tournament_results` via migration (drop table).

### 1e. RLS no Supabase

```sql
-- participants: todos podem ler, admin insere/edita/remove
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);
CREATE POLICY "participants_admin" ON participants FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- transactions: todos podem ler, admin insere
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (true);
CREATE POLICY "transactions_admin" ON transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
```

---

## Step 2: Queries (`src/db/queries/participants.ts`)

```typescript
// getParticipants(tournamentId) — retorna participantes com join em users para nome/nickname
// getParticipantCount(tournamentId) — COUNT para exibicao rapida
// getParticipantByUserAndTournament(userId, tournamentId) — verificar duplicata
```

### `src/db/queries/transactions.ts`

```typescript
// getTransactions(tournamentId) — todas transacoes do torneio com join em users
// getTournamentFinancialSummary(tournamentId) — soma agrupada por tipo (buy_in, rebuy, addon, prize)
```

---

## Step 3: Server Actions (`src/actions/participants.ts`)

### 3a. `addParticipant(tournamentId, userId)`
- Admin only
- Verifica se torneio existe e nao esta cancelled/finished
- Verifica se jogador ja esta inscrito
- Insere participante com status "registered"

### 3b. `removeParticipant(tournamentId, userId)`
- Admin only
- Apenas se status do participante for "registered" (nao pode remover quem ja pagou buy-in ou esta jogando)
- Remove transacoes associadas

### 3c. `confirmBuyIn(participantId)`
- Admin only
- Atualiza buy_in_paid = true, status = "playing"
- Cria transacao tipo "buy_in" com valor do torneio
- Recalcula prize pool

### 3d. `addRebuy(participantId)`
- Admin only
- Verifica se torneio permite rebuy e se nao excedeu max_rebuys
- Incrementa rebuy_count
- Cria transacao tipo "rebuy"

### 3e. `addAddon(participantId)`
- Admin only
- Verifica se torneio permite addon e se jogador ainda nao usou
- Atualiza addon_used = true
- Cria transacao tipo "addon"

### 3f. `eliminatePlayer(participantId)`
- Admin only
- Calcula posicao automaticamente: conta quantos jogadores ainda estao "playing" + 1
- Atualiza status = "eliminated", finish_position, eliminated_at
- Se for ultimo jogador eliminado (restou 1 "playing"), o que sobrou eh o campeao (finish_position = 1, status = "finished")

### 3g. `distributePayouts(tournamentId)`
- Admin only
- Usa a tabela prize_structures para calcular valores reais baseado no prize pool total
- Cria transacoes tipo "prize" para cada posicao premiada
- Atualiza prize_amount nos participantes

### 3h. `undoElimination(participantId)`
- Admin only
- Reverte eliminacao: status volta para "playing", limpa finish_position e eliminated_at

---

## Step 4: Componentes UI

### 4a. `src/components/tournament/participant-list.tsx`
Lista de participantes do torneio com:
- Nome/nickname do jogador
- Status badge (registrado, jogando, eliminado, finalizado)
- Indicadores: buy-in pago, qtd rebuys, addon usado
- Posicao final (se eliminado/finalizado)
- Acoes do admin: confirmar buy-in, rebuy, addon, eliminar, desfazer eliminacao

### 4b. `src/components/tournament/add-participant-dialog.tsx`
Dialog para admin adicionar jogador ao torneio:
- Select/Combobox com busca por nome ou nickname
- Lista apenas jogadores que NAO estao inscritos ainda
- Botao para adicionar

### 4c. `src/components/tournament/financial-summary.tsx`
Card resumo financeiro do torneio:
- Total buy-ins (qtd x valor)
- Total rebuys (qtd x valor)
- Total add-ons (qtd x valor)
- **Prize pool total** (soma buy-ins + rebuys + addons, ou override se existir)
- Premios distribuidos vs pendentes
- Saldo (prize pool - premios pagos)

### 4d. `src/components/tournament/payout-dialog.tsx`
Dialog para distribuir premios:
- Mostra posicoes premiadas com base na prize_structure
- Calcula valores automaticamente com base no prize pool
- Permite ajuste manual (acordos)
- Botao "Distribuir" cria as transacoes

---

## Step 5: Paginas

### 5a. Atualizar `src/app/(dashboard)/torneios/[id]/page.tsx`
- Adicionar aba "Jogadores" no Tabs existente
- Mostrar participant-list + add-participant-dialog (se admin)
- Atualizar aba "Premios" para usar dados dos participants em vez de tournament_results
- Adicionar financial-summary na aba "Visao Geral"

### 5b. Nova pagina (opcional) `src/app/(dashboard)/torneios/[id]/financeiro/page.tsx`
Pagina dedicada ao financeiro do torneio com:
- Financial summary completo
- Lista de todas as transacoes
- Filtros por tipo (buy-in, rebuy, addon, premio)

---

## Step 6: Limpeza

### 6a. Remover `tournament_results`
- Dropar tabela `tournament_results` (migration)
- Remover schema `src/db/schema/tournament_results.ts`
- Remover `TournamentResultsEditor` component
- Remover action `saveTournamentResults`
- Remover query `getTournamentResults`
- Atualizar imports em todo lugar

### 6b. Atualizar tournament card
- Adicionar contagem de participantes no card de listagem de torneios
- Mostrar prize pool calculado

### 6c. Atualizar navigation
- Verificar se precisa de link para financeiro na sidebar/nav

---

## Decisoes de design

1. **Eliminacao automatica de posicao**: ao eliminar um jogador, o sistema calcula a posicao baseado em quantos "playing" restam. Se restam 5 jogando, o eliminado fica em 6o. Isso evita input manual e erros.

2. **Prize pool calculado vs override**: o prize pool eh calculado somando transacoes de buy_in + rebuy + addon. Se o torneio tiver `prize_pool_override`, esse valor prevalece. Isso permite ajustes manuais pelo admin.

3. **Transacoes como log imutavel**: transacoes nunca sao editadas, apenas criadas. Para "desfazer", cria-se uma transacao reversa (estorno). Excecao: ao remover participante nao-pago, remove as transacoes associadas.

4. **Sem self-service de jogadores nesta fase**: apenas admin gerencia participantes. Jogadores podem apenas visualizar. Self-registration pode ser adicionado em fase futura.

---

## Ordem de execucao sugerida

1. Steps 1a–1e: schemas + migration + RLS
2. Step 2: queries
3. Step 3: server actions
4. Step 4: componentes UI
5. Step 5: paginas
6. Step 6: limpeza do tournament_results
7. Testes manuais end-to-end

---

## Dependencias

- Tabela `users` precisa ter dados (jogadores cadastrados) para funcionar
- Admin precisa existir para gerenciar participantes
- Blind structures e prize structures do torneio devem estar configuradas antes de distribuir premios

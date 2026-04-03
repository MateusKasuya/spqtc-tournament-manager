# Fase Extra — Players desvinculados de Auth + Remoção de auto-inscrição

## Objetivo
Criar tabela `players` independente de autenticação. O admin gerencia todos os jogadores. Login serve apenas para admins. Remover fluxo de registro público e auto-inscrição em torneios.

---

## Etapa 1: Nova tabela `players` + migração de schema

### 1.1 Criar `src/db/schema/players.ts`
```ts
import { pgTable, serial, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname").unique(),
  userId: uuid("user_id").references(() => users.id), // nullable, vínculo futuro
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 1.2 Atualizar `src/db/schema/participants.ts`
- Trocar `userId: uuid("user_id").references(() => users.id).notNull()` por `playerId: integer("player_id").references(() => players.id).notNull()`
- Trocar unique constraint: `unique().on(table.tournamentId, table.playerId)`
- Remover import de `users`, adicionar import de `players`
- Adicionar import de `integer`

**De:**
```ts
import { users } from "./users";
// ...
userId: uuid("user_id").references(() => users.id).notNull(),
// ...
unique().on(table.tournamentId, table.userId),
```
**Para:**
```ts
import { players } from "./players";
// ...
playerId: integer("player_id").references(() => players.id).notNull(),
// ...
unique().on(table.tournamentId, table.playerId),
```

### 1.3 Atualizar `src/db/schema/transactions.ts`
- Trocar `userId: uuid("user_id").references(() => users.id).notNull()` por `playerId: integer("player_id").references(() => players.id).notNull()`
- Remover import de `users`, adicionar import de `players`

### 1.4 Atualizar `src/db/schema/index.ts`
Adicionar export:
```ts
export { players } from "./players";
```

### 1.5 Gerar e aplicar migração
```bash
npx drizzle-kit generate
npx drizzle-kit push
```
> **IMPORTANTE:** Se já existem dados em produção, será necessário um script de migração que:
> 1. Cria a tabela `players`
> 2. Para cada `user` com role `player`, cria um registro em `players` com `user_id` vinculado
> 3. Atualiza `participants.player_id` e `transactions.player_id` com os IDs corretos
> 4. Remove as colunas antigas `user_id`

---

## Etapa 2: Queries — Adaptar para `players`

### 2.1 Criar `src/db/queries/players.ts`
```ts
import { db } from "@/db";
import { players } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function getAllPlayers() {
  return db
    .select({
      id: players.id,
      name: players.name,
      nickname: players.nickname,
    })
    .from(players)
    .orderBy(asc(players.name));
}

export async function getPlayerById(id: number) {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, id));
  return player ?? null;
}
```

### 2.2 Atualizar `src/db/queries/participants.ts`
- `getParticipants()`: trocar join de `users` para `players`, selecionar `playerId` ao invés de `userId`, e `players.name`/`players.nickname`
- `getParticipantByUserAndTournament()` → renomear para `getParticipantByPlayerAndTournament(playerId: number, tournamentId: number)`, usar `eq(participants.playerId, playerId)`
- Remover import de `users`, adicionar import de `players`

**`getParticipants` — De:**
```ts
.select({
  // ...
  userId: participants.userId,
  name: users.name,
  nickname: users.nickname,
  // ...
})
.from(participants)
.innerJoin(users, eq(participants.userId, users.id))
```
**Para:**
```ts
.select({
  // ...
  playerId: participants.playerId,
  name: players.name,
  nickname: players.nickname,
  // ...
})
.from(participants)
.innerJoin(players, eq(participants.playerId, players.id))
```

### 2.3 Atualizar `src/db/queries/transactions.ts`
- `getTransactions()`: trocar join de `users` para `players`, `playerId` ao invés de `userId`

**De:**
```ts
.innerJoin(users, eq(transactions.userId, users.id))
```
**Para:**
```ts
.innerJoin(players, eq(transactions.playerId, players.id))
```

### 2.4 Remover `src/db/queries/users.ts` (ou manter só para admin)
- A função `getAllUsers()` não será mais usada para listar jogadores disponíveis
- Se precisar para algo admin-específico, pode manter. Caso contrário, deletar.

---

## Etapa 3: Server Actions — Adaptar para `players`

### 3.1 Atualizar `src/actions/participants.ts`

**`addParticipant(tournamentId, playerId: number)`:**
- Parâmetro muda de `userId: string` para `playerId: number`
- `getParticipantByPlayerAndTournament(playerId, tournamentId)` ao invés de `getParticipantByUserAndTournament`
- `db.insert(participants).values({ tournamentId, playerId })`

**`confirmBuyIn`, `addRebuy`, `addAddon`:**
- Onde faz `db.insert(transactions).values({ ..., userId: participant.userId, ... })` trocar para `playerId: participant.playerId`

**`distributePayouts`:**
- Tipo do parâmetro muda: `payouts: { playerId: number; amount: number; position: number }[]`
- Onde faz `userId: payout.userId` → `playerId: payout.playerId`
- Onde faz `eq(participants.userId, payout.userId)` → `eq(participants.playerId, payout.playerId)`

**`selfRegister`:**
- **DELETAR INTEIRAMENTE** — não existe mais auto-inscrição

### 3.2 Criar `src/actions/players.ts`
```ts
"use server";

import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
// + requireAdmin() (extrair para utils ou copiar)

export async function createPlayer(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = formData.get("name") as string;
  const nickname = (formData.get("nickname") as string) || null;

  if (!name || name.length < 2) return { error: "Nome deve ter pelo menos 2 caracteres" };

  await db.insert(players).values({ name, nickname });

  revalidatePath("/jogadores");
  return { success: true };
}

export async function updatePlayer(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = formData.get("name") as string;
  const nickname = (formData.get("nickname") as string) || null;

  await db.update(players).set({ name, nickname }).where(eq(players.id, id));

  revalidatePath("/jogadores");
  return { success: true };
}

export async function deletePlayer(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(players).where(eq(players.id, id));

  revalidatePath("/jogadores");
  return { success: true };
}
```

> **Nota:** A função `requireAdmin()` atualmente está definida dentro de `participants.ts`. Extrair para `src/lib/require-admin.ts` e compartilhar entre `participants.ts` e `players.ts`.

---

## Etapa 4: Página de Jogadores (Admin)

### 4.1 Criar `src/app/(dashboard)/jogadores/page.tsx`
- Listar todos os players com nome e nickname
- Botão "Novo Jogador" (abre dialog ou vai para página de criação)
- Cada jogador tem botões de editar e excluir
- Apenas admin pode acessar (redirect se não admin)

### 4.2 Criar componentes auxiliares
- `src/components/player/create-player-dialog.tsx` — Dialog com formulário nome + nickname
- `src/components/player/edit-player-dialog.tsx` — Dialog de edição
- `src/components/player/delete-player-button.tsx` — Botão com confirmação

---

## Etapa 5: Atualizar componentes existentes

### 5.1 `src/components/tournament/add-participant-dialog.tsx`
- Interface `User` → `Player` com `id: number` (era `string`)
- Props: `availableUsers` → `availablePlayers`
- Chamar `addParticipant(tournamentId, selectedPlayerId)` com `number`
- Select mostra `players` ao invés de `users`

### 5.2 `src/components/tournament/participant-list.tsx`
- Interface `Participant`: trocar `userId: string` → `playerId: number`
- Nenhuma outra mudança visual necessária (já usa `name` e `nickname`)

### 5.3 `src/components/tournament/payout-dialog.tsx`
- Interface `ParticipantOption`: trocar `userId: string` → `playerId: number`
- Interface `PayoutEntry`: trocar `userId: string` → `playerId: string` (value do select) ou `number`
- `distributePayouts` chamado com `playerId` ao invés de `userId`

### 5.4 `src/components/live-table/mesa-ao-vivo.tsx`
- Interface `Participant` não tem `userId`, então **nenhuma mudança** aqui
- Verificar `quick-actions.tsx` e `tournament-stats.tsx` — provavelmente sem mudança

---

## Etapa 6: Atualizar página do torneio (`torneios/[id]/page.tsx`)

### 6.1 Trocar `getAllUsers()` por `getAllPlayers()`
- Import: `import { getAllPlayers } from "@/db/queries/players"`
- `const allPlayers = await getAllPlayers()` (ao invés de `allUsers`)
- Filtro de disponíveis: `allPlayers.filter((p) => !participantPlayerIds.has(p.id))`
- `participantPlayerIds = new Set(participantsList.map((p) => p.playerId))`

### 6.2 Remover lógica de self-registration
- Remover import de `SelfRegisterButton`
- Remover import de `CopyInviteLinkButton`
- Remover bloco `{!isAdmin && isActive && (...)}` (linhas 96-118, banner de inscrição)
- Remover `{isActive && <CopyInviteLinkButton .../>}` (linha 141)
- Remover variável `isRegistered`

### 6.3 Payout — usar `playerId`
- Onde passa `userId: p.userId` para o PayoutDialog → `playerId: p.playerId`

---

## Etapa 7: Remover fluxo de registro e auto-inscrição

### 7.1 Deletar arquivos
- `src/app/(auth)/register/page.tsx`
- `src/app/(dashboard)/torneios/[id]/inscricao/page.tsx` (pasta inteira)
- `src/components/tournament/self-register-button.tsx`
- `src/components/tournament/copy-invite-link-button.tsx`

### 7.2 Atualizar `src/actions/auth.ts`
- Remover `register()` function e `registerSchema`
- Manter apenas `login()` e `logout()`

### 7.3 Atualizar `src/app/(auth)/login/page.tsx`
- Remover link "Não tem conta? Cadastre-se" (linhas 85-93)

### 7.4 Atualizar `src/middleware.ts`
- Remover `/register` da lista `publicRoutes`
```ts
const publicRoutes = ["/login", "/api/auth/callback"];
```

---

## Etapa 8: Simplificar auth/navegação

### 8.1 Supabase — Desabilitar confirmação de email
- No dashboard do Supabase: Authentication > Settings > desabilitar "Enable email confirmations"
- **Isso é configuração no Supabase Dashboard, não no código**

### 8.2 Atualizar `src/lib/navigation.ts`
- Pode manter "Jogadores" no nav (agora é a página CRUD de players)
- Se quiser esconder itens para não-admins, adicionar campo `adminOnly` no NAV_ITEMS

---

## Etapa 9: Dashboard

### 9.1 Atualizar `src/app/(dashboard)/dashboard/page.tsx`
- Como login agora é só para admins, o dashboard pode assumir que o usuário é admin
- Ou manter a verificação `isAdmin` para forward-compatibility caso no futuro players façam login

---

## Resumo de arquivos afetados

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `src/db/schema/players.ts` | Schema da tabela players |
| `src/db/queries/players.ts` | Queries para players |
| `src/actions/players.ts` | CRUD actions de players |
| `src/lib/require-admin.ts` | Função requireAdmin compartilhada |
| `src/app/(dashboard)/jogadores/page.tsx` | Página de listagem de jogadores |
| `src/components/player/create-player-dialog.tsx` | Dialog de criação |
| `src/components/player/edit-player-dialog.tsx` | Dialog de edição |
| `src/components/player/delete-player-button.tsx` | Botão de exclusão |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `src/db/schema/participants.ts` | `userId` → `playerId` (FK players) |
| `src/db/schema/transactions.ts` | `userId` → `playerId` (FK players) |
| `src/db/schema/index.ts` | Adicionar export de players |
| `src/db/queries/participants.ts` | Join com players, renomear funções |
| `src/db/queries/transactions.ts` | Join com players |
| `src/actions/participants.ts` | `userId` → `playerId`, remover selfRegister |
| `src/actions/auth.ts` | Remover register() |
| `src/app/(auth)/login/page.tsx` | Remover link de cadastro |
| `src/app/(dashboard)/torneios/[id]/page.tsx` | Usar players, remover self-register UI |
| `src/components/tournament/add-participant-dialog.tsx` | Users → Players |
| `src/components/tournament/participant-list.tsx` | userId → playerId |
| `src/components/tournament/payout-dialog.tsx` | userId → playerId |
| `src/middleware.ts` | Remover /register das rotas públicas |

### Deletados
| Arquivo | Motivo |
|---------|--------|
| `src/app/(auth)/register/page.tsx` | Não há mais registro público |
| `src/app/(dashboard)/torneios/[id]/inscricao/` | Não há mais auto-inscrição |
| `src/components/tournament/self-register-button.tsx` | Idem |
| `src/components/tournament/copy-invite-link-button.tsx` | Link de inscrição não existe mais |
| `src/db/queries/users.ts` | Substituído por queries/players.ts |

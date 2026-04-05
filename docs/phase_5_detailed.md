# Fase 5 — Ranking & Estatisticas

## Objetivo

Implementar o sistema de ranking por temporada e estatisticas individuais dos jogadores, replicando a planilha RANKING.xlsx usada atualmente pelo SPQC. O ranking acumula pontos de cada etapa (torneio) finalizada dentro de uma temporada.

---

## Sistema de Pontuacao SPQC

### Tabela de pontos

| Posicao | Pontos |
|---------|--------|
| 1o      | 12     |
| 2o      | 10     |
| 3o      | 8      |
| 4o      | 6      |
| 5o      | 4      |
| 6o      | 2      |
| 7o+     | 1      |
| Ausente | 0      |

### Quando os pontos sao atribuidos

Pontos sao calculados automaticamente com base na `finishPosition` do participante. A atribuicao acontece quando o torneio eh finalizado (status → `finished`).

### Ranking fee

Cada torneio desconta R$20 fixos por jogador inscrito (campo `rankingFeeAmount` no schema, default ja configurado). A soma desses valores ao longo da temporada forma o fundo de ranking (ex: R$1.099 na temporada 2026 ate a 4a etapa).

O prize pool do torneio = gastos totais dos jogadores - (ranking fee × numero de jogadores com buy-in pago).

### Financeiro por jogador na temporada

A planilha atual rastreia por jogador:
- **Gastos**: soma de buy-in + rebuys + addon de todos os torneios
- **Premiacao**: soma de premios recebidos
- **GREEN/RED**: premiacao - gastos (lucro/prejuizo)

Esses valores ja sao derivaveis das tabelas `participants` e `transactions` existentes, sem necessidade de campos novos.

---

## Etapa 1: Atribuicao automatica de `finishPosition` e pontos

### 1.1 Criar `src/lib/points-table.ts`

```typescript
const POINTS_TABLE: Record<number, number> = {
  1: 12,
  2: 10,
  3: 8,
  4: 6,
  5: 4,
  6: 2,
};

const DEFAULT_POINTS = 1;

export function getPointsForPosition(position: number): number {
  return POINTS_TABLE[position] ?? DEFAULT_POINTS;
}
```

### 1.2 Atualizar `src/actions/participants.ts` — `eliminatePlayer`

Ao eliminar um jogador, atribuir `finishPosition` automaticamente:

```typescript
// Antes de atualizar o status:
const playingCount = await getPlayingCount(tournamentId);
// O jogador eliminado ocupa a posicao = playingCount
const finishPosition = playingCount;

await db
  .update(participants)
  .set({
    status: "eliminated",
    eliminatedAt: new Date(),
    finishPosition,
  })
  .where(eq(participants.id, participantId));
```

### 1.3 Atualizar `src/actions/tournaments.ts` — `advanceTournamentStatus` (ao finalizar)

Quando o torneio muda para `finished`:

1. O ultimo jogador `playing` recebe `finishPosition: 1` e `status: "finished"`
2. Calcular e gravar `pointsEarned` para todos os participantes que tem `finishPosition`:

```typescript
import { getPointsForPosition } from "@/lib/points-table";

// Ao mudar status para "finished":
// 1. Campeao
const playingParticipants = allParticipants.filter(p => p.status === "playing");
if (playingParticipants.length === 1) {
  await db.update(participants).set({
    finishPosition: 1,
    status: "finished",
  }).where(eq(participants.id, playingParticipants[0].id));
}

// 2. Atribuir pontos a todos com finishPosition
const finalParticipants = await getParticipants(tournamentId);
for (const p of finalParticipants) {
  if (p.finishPosition) {
    const points = getPointsForPosition(p.finishPosition);
    await db
      .update(participants)
      .set({ pointsEarned: String(points) })
      .where(eq(participants.id, p.id));
  }
}
```

**Nota:** Jogadores que foram inscritos mas nao jogaram (ausentes/sem buy-in pago) ficam com `finishPosition: null` e `pointsEarned: 0` — nao contam no ranking daquela etapa.

---

## Etapa 2: Queries de Ranking

### 2.1 Criar `src/db/queries/ranking.ts`

```typescript
import { db } from "@/db";
import { participants, players, tournaments, transactions } from "@/db/schema";
import { eq, and, sum, count, desc, sql, isNotNull } from "drizzle-orm";

// Ranking geral de uma temporada (replica aba "geral" da planilha)
export async function getSeasonRanking(seasonId: number) {
  return db
    .select({
      playerId: participants.playerId,
      playerName: players.name,
      playerNickname: players.nickname,
      totalPoints: sum(participants.pointsEarned).as("total_points"),
      tournamentsPlayed: count(participants.id).as("tournaments_played"),
      bestPosition: sql<number>`MIN(${participants.finishPosition})`.as("best_position"),
      wins: sql<number>`COUNT(CASE WHEN ${participants.finishPosition} = 1 THEN 1 END)`.as("wins"),
    })
    .from(participants)
    .innerJoin(players, eq(participants.playerId, players.id))
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(tournaments.seasonId, seasonId),
        eq(tournaments.status, "finished"),
        isNotNull(participants.finishPosition)
      )
    )
    .groupBy(participants.playerId, players.name, players.nickname)
    .orderBy(desc(sql`total_points`));
}

// Pontos de cada etapa por jogador (para as colunas 1a, 2a, 3a... da planilha)
export async function getSeasonPointsByTournament(seasonId: number) {
  return db
    .select({
      playerId: participants.playerId,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      tournamentDate: tournaments.date,
      finishPosition: participants.finishPosition,
      pointsEarned: participants.pointsEarned,
    })
    .from(participants)
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(tournaments.seasonId, seasonId),
        eq(tournaments.status, "finished")
      )
    )
    .orderBy(tournaments.date);
}

// Financeiro por jogador na temporada (replica aba financeira da planilha)
export async function getSeasonFinancials(seasonId: number) {
  return db
    .select({
      playerId: participants.playerId,
      playerName: players.name,
      playerNickname: players.nickname,
      totalBuyIns: count(participants.id).as("total_buyins"),
      totalRebuys: sum(participants.rebuyCount).as("total_rebuys"),
      totalAddons: sql<number>`COUNT(CASE WHEN ${participants.addonUsed} = true THEN 1 END)`.as("total_addons"),
      totalPrize: sum(participants.prizeAmount).as("total_prize"),
      wins: sql<number>`COUNT(CASE WHEN ${participants.finishPosition} = 1 THEN 1 END)`.as("wins"),
    })
    .from(participants)
    .innerJoin(players, eq(participants.playerId, players.id))
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(tournaments.seasonId, seasonId),
        eq(tournaments.status, "finished"),
        eq(participants.buyInPaid, true)
      )
    )
    .groupBy(participants.playerId, players.name, players.nickname)
    .orderBy(desc(sql`total_prize`));
}

// Nota: "gastos" por jogador eh calculado no frontend a partir dos dados do torneio:
// gastos = SUM(buyInAmount + rebuyCount * rebuyAmount + (addonUsed ? addonAmount : 0))
// Para isso, a query precisa trazer os valores do torneio junto. Alternativa: calcular via SQL.

// Estatisticas gerais de um jogador (todas as temporadas)
export async function getPlayerStats(playerId: number) {
  const [stats] = await db
    .select({
      totalPoints: sum(participants.pointsEarned).as("total_points"),
      tournamentsPlayed: count(participants.id).as("tournaments_played"),
      bestPosition: sql<number>`MIN(${participants.finishPosition})`.as("best_position"),
      wins: sql<number>`COUNT(CASE WHEN ${participants.finishPosition} = 1 THEN 1 END)`.as("wins"),
      totalPrize: sum(participants.prizeAmount).as("total_prize"),
      totalRebuys: sum(participants.rebuyCount).as("total_rebuys"),
      avgPosition: sql<number>`AVG(${participants.finishPosition})`.as("avg_position"),
    })
    .from(participants)
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(participants.playerId, playerId),
        eq(tournaments.status, "finished"),
        isNotNull(participants.finishPosition)
      )
    );

  return stats;
}

// Historico de torneios de um jogador em uma temporada
export async function getPlayerSeasonHistory(playerId: number, seasonId: number) {
  return db
    .select({
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      tournamentDate: tournaments.date,
      buyInAmount: tournaments.buyInAmount,
      rebuyAmount: tournaments.rebuyAmount,
      addonAmount: tournaments.addonAmount,
      finishPosition: participants.finishPosition,
      pointsEarned: participants.pointsEarned,
      prizeAmount: participants.prizeAmount,
      rebuyCount: participants.rebuyCount,
      addonUsed: participants.addonUsed,
    })
    .from(participants)
    .innerJoin(tournaments, eq(participants.tournamentId, tournaments.id))
    .where(
      and(
        eq(participants.playerId, playerId),
        eq(tournaments.seasonId, seasonId),
        eq(tournaments.status, "finished")
      )
    )
    .orderBy(desc(tournaments.date));
}
```

---

## Etapa 3: Pagina de Ranking

### 3.1 Criar `src/app/(dashboard)/ranking/page.tsx`

```typescript
import { getSeasonRanking, getSeasonPointsByTournament } from "@/db/queries/ranking";
import { getActiveSeason, getSeasons } from "@/db/queries/seasons";
import { getTournaments } from "@/db/queries/tournaments";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { RankingTable } from "@/components/ranking/ranking-table";
import { SeasonSelector } from "@/components/ranking/season-selector";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const seasons = await getSeasons();
  const activeSeason = await getActiveSeason();

  const selectedSeasonId = params.season
    ? Number(params.season)
    : activeSeason?.id;

  if (!selectedSeasonId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Ranking</h1>
        <p className="text-muted-foreground">Nenhuma temporada encontrada.</p>
      </div>
    );
  }

  const [ranking, pointsByTournament, allTournaments] = await Promise.all([
    getSeasonRanking(selectedSeasonId),
    getSeasonPointsByTournament(selectedSeasonId),
    getTournaments(), // filtrar por seasonId no frontend
  ]);

  // Etapas finalizadas desta temporada (para colunas "1a, 2a, 3a...")
  const seasonTournaments = allTournaments
    .filter((t) => t.seasonId === selectedSeasonId && t.status === "finished")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ranking</h1>
        <SeasonSelector
          seasons={seasons}
          selectedSeasonId={selectedSeasonId}
        />
      </div>
      <RankingTable
        ranking={ranking}
        pointsByTournament={pointsByTournament}
        seasonTournaments={seasonTournaments}
      />
    </div>
  );
}
```

### 3.2 Criar `src/components/ranking/season-selector.tsx`

Client component com `<Select>` que redireciona para `/ranking?season={id}`.

### 3.3 Criar `src/components/ranking/ranking-table.tsx`

Tabela que replica a aba "geral" da planilha:

| # | Jogador | Pontos | 1a | 2a | 3a | 4a | ... |
|---|---------|--------|----|----|----|----| --- |

- Coluna de posicao com icones de podio (ouro/prata/bronze) para top 3
- Colunas dinamicas por etapa mostrando os pontos daquela etapa (ou "-" se ausente)
- Total de pontos em destaque
- Cada linha clicavel → `/jogadores/{id}`
- Responsivo: no mobile esconder colunas de etapas e mostrar so posicao/nome/pontos

---

## Etapa 4: Pagina de Perfil do Jogador

### 4.1 Criar `src/app/(dashboard)/jogadores/[id]/page.tsx`

Server component que busca player, stats e historico.

### 4.2 Criar `src/components/player/player-profile.tsx`

Exibe:

- **Header**: Nome/nickname
- **Stats cards** (grid 2x2):
  - Total de pontos
  - Torneios jogados
  - Vitorias (1o lugar)
  - Media de posicao
- **Financeiro** (replica GREEN/RED da planilha):
  - Total gastos
  - Total premiacao
  - Saldo (GREEN/RED) com cor verde/vermelha
- **Historico da temporada atual**: tabela por etapa com posicao, pontos, gastos, premio, saldo

---

## Etapa 5: Ranking fee e calculo de prize pool

### 5.1 Verificar calculo existente

O campo `rankingFeeAmount` ja existe no schema de tournaments (default R$20/2000 centavos). Verificar se o calculo do prize pool no `financial-summary.tsx` ja desconta o ranking fee:

```
prizePool = totalArrecadado - (rankingFee * jogadoresComBuyIn)
```

Se nao, ajustar o calculo em `src/db/queries/transactions.ts` ou no componente `financial-summary.tsx`.

### 5.2 Mostrar ranking fee acumulado na temporada

Na pagina de ranking, exibir o total do fundo de ranking da temporada:

```
fundoRanking = SUM(rankingFeeAmount * jogadoresComBuyIn) para todos os torneios da temporada
```

---

## Etapa 6: Vincular torneios a temporada

### 6.1 Atualizar `src/components/tournament/tournament-form.tsx`

Adicionar campo select de `seasonId` no formulario de criacao/edicao:

- Select com todas as temporadas disponíveis
- Default = temporada ativa
- Opcao "Sem temporada" com valor null

### 6.2 Atualizar `src/actions/tournaments.ts`

Aceitar e gravar `seasonId` vindo do form no `createTournament` e `updateTournament`.

---

## Etapa 7: CRUD de Temporadas

### 7.1 Criar `src/app/(dashboard)/temporadas/page.tsx`

Pagina admin-only para:
- Listar temporadas existentes
- Criar nova temporada (nome, data inicio)
- Marcar temporada como ativa/inativa
- Editar nome/datas

### 7.2 Criar `src/actions/seasons.ts`

```typescript
"use server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function createSeason(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;

  if (!name || !startDate) return { error: "Nome e data de inicio sao obrigatorios" };

  // Desativar temporadas anteriores
  await db.update(seasons).set({ isActive: false });

  await db.insert(seasons).values({ name, startDate, isActive: true });

  revalidatePath("/temporadas");
  revalidatePath("/ranking");
  return { success: true };
}

export async function toggleSeasonActive(seasonId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.update(seasons).set({ isActive: false });
  await db.update(seasons).set({ isActive: true }).where(eq(seasons.id, seasonId));

  revalidatePath("/temporadas");
  revalidatePath("/ranking");
  return { success: true };
}
```

### 7.3 Atualizar `src/lib/navigation.ts`

Adicionar item de Temporadas (admin only):

```typescript
import { Calendar } from "lucide-react";
// ...
{ label: "Temporadas", href: "/temporadas", icon: Calendar, adminOnly: true },
```

---

## Etapa 8: Integracao e links

### 8.1 Ranking table → perfil do jogador

Cada linha da tabela de ranking eh clicavel, levando para `/jogadores/{playerId}`.

### 8.2 Dashboard — widget de ranking

Adicionar card no dashboard mostrando top 5 do ranking da temporada ativa, com link para `/ranking`.

### 8.3 Pagina do torneio finalizado

Na pagina de detalhes do torneio (`/torneios/[id]`), quando status eh `finished`, mostrar mini-ranking do torneio (posicao, nome, pontos ganhos).

---

## Resumo de arquivos

### Novos
| Arquivo | Descricao |
|---------|-----------|
| `src/lib/points-table.ts` | Tabela de pontos SPQC (12/10/8/6/4/2/1) |
| `src/db/queries/ranking.ts` | Queries de ranking, financeiro e stats |
| `src/app/(dashboard)/ranking/page.tsx` | Pagina de ranking |
| `src/components/ranking/ranking-table.tsx` | Tabela estilo planilha com colunas por etapa |
| `src/components/ranking/season-selector.tsx` | Select de temporada |
| `src/app/(dashboard)/jogadores/[id]/page.tsx` | Perfil do jogador |
| `src/components/player/player-profile.tsx` | Componente de perfil com stats e GREEN/RED |
| `src/app/(dashboard)/temporadas/page.tsx` | CRUD de temporadas |
| `src/actions/seasons.ts` | Server actions de temporadas |

### Modificados
| Arquivo | Mudanca |
|---------|---------|
| `src/actions/participants.ts` | `eliminatePlayer` grava `finishPosition` automaticamente |
| `src/actions/tournaments.ts` | Finalizar torneio atribui pontos + gravar `seasonId` |
| `src/components/tournament/tournament-form.tsx` | Campo `seasonId` no form |
| `src/lib/navigation.ts` | Adicionar Temporadas no nav |
| `src/app/(dashboard)/dashboard/page.tsx` | Widget top 5 ranking |

---

## Ordem de execucao sugerida

1. Etapa 1: points-table + finishPosition automatico + pontos ao finalizar
2. Etapa 2: queries de ranking
3. Etapa 7: CRUD de temporadas (pre-requisito: precisa ter temporada para o ranking)
4. Etapa 6: vincular torneios a temporada no form
5. Etapa 3: pagina de ranking + componentes
6. Etapa 4: perfil do jogador
7. Etapa 5: ranking fee no calculo do prize pool
8. Etapa 8: integracao (links, dashboard widget, mini-ranking)
9. Testes manuais end-to-end

---

## Dependencias

- Temporada precisa existir para o ranking funcionar (Etapa 7 antes da 3)
- Torneios precisam ter `seasonId` preenchido
- Torneios precisam ter status `finished` para contar no ranking
- `finishPosition` precisa estar populada nos participantes (Etapa 1)
- `pointsEarned` precisa ser gravado ao finalizar o torneio (Etapa 1)

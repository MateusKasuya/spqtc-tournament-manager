# Fase 4 — Mesa ao Vivo & Timer Realtime

## Visao geral

Esta fase implementa a tela principal usada durante um torneio em andamento: a "Mesa ao Vivo". Inclui um timer de countdown sincronizado em tempo real entre todos os dispositivos (admin no notebook, jogadores no celular), controles de blind level, estatisticas ao vivo e acoes rapidas para o admin.

**O que muda em relacao ao estado atual:**
- Os campos de timer no schema (`currentBlindLevel`, `timerRunning`, `timerRemainingSecs`, `timerStartedAt`) passam a ser usados.
- Supabase Realtime eh habilitado nas tabelas `tournaments` e `participants` para sincronizacao automatica.
- Nova pagina `/torneios/[id]/mesa` com interface otimizada para uso durante o jogo.

**Arquitetura do timer:**
- Estado vive no banco: `timerStartedAt` (ancora) + `timerRemainingSecs` (duracao total do nivel quando foi iniciado/pausado).
- Timer rodando: cliente calcula `restante = timerRemainingSecs - (agora - timerStartedAt)` localmente.
- Timer pausado: `timerRemainingSecs` guarda o valor congelado, `timerStartedAt` eh null.
- Supabase Realtime escuta mudancas na row do torneio e atualiza o estado em todos os clientes.

---

## Step 1: Habilitar Realtime no Supabase

Rodar via Supabase SQL Editor (ou migration):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments, participants;
```

Isso permite que clientes recebam eventos de UPDATE/INSERT/DELETE em tempo real nessas tabelas.

---

## Step 2: Server Actions do Timer

### Arquivo: `src/actions/tournaments.ts` — adicionar 4 actions

### 2a. `startTimer(tournamentId)`

```typescript
export async function startTimer(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      timerRemainingSecs: tournaments.timerRemainingSecs,
      currentBlindLevel: tournaments.currentBlindLevel,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  let remainingSecs = tournament.timerRemainingSecs;

  // Se timer nunca foi iniciado, pega duracao do blind level atual
  if (remainingSecs === null || remainingSecs === undefined) {
    const blinds = await db
      .select({ durationMinutes: blindStructures.durationMinutes })
      .from(blindStructures)
      .where(
        and(
          eq(blindStructures.tournamentId, tournamentId),
          eq(blindStructures.level, tournament.currentBlindLevel)
        )
      );

    remainingSecs = (blinds[0]?.durationMinutes ?? 15) * 60;
  }

  await db
    .update(tournaments)
    .set({
      timerRunning: true,
      timerStartedAt: new Date(),
      timerRemainingSecs: remainingSecs,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}
```

### 2b. `pauseTimer(tournamentId)`

```typescript
export async function pauseTimer(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      timerRemainingSecs: tournaments.timerRemainingSecs,
      timerStartedAt: tournaments.timerStartedAt,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament || !tournament.timerStartedAt) return { error: "Timer nao esta rodando" };

  const elapsed = Math.floor((Date.now() - new Date(tournament.timerStartedAt).getTime()) / 1000);
  const remaining = Math.max(0, (tournament.timerRemainingSecs ?? 0) - elapsed);

  await db
    .update(tournaments)
    .set({
      timerRunning: false,
      timerStartedAt: null,
      timerRemainingSecs: remaining,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}
```

### 2c. `advanceBlindLevel(tournamentId)`

```typescript
export async function advanceBlindLevel(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({
      currentBlindLevel: tournaments.currentBlindLevel,
      timerRunning: tournaments.timerRunning,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const blinds = await db
    .select()
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);

  const currentIndex = blinds.findIndex((b) => b.level === tournament.currentBlindLevel);
  const nextLevel = blinds[currentIndex + 1];

  if (!nextLevel) return { error: "Ja esta no ultimo nivel" };

  await db
    .update(tournaments)
    .set({
      currentBlindLevel: nextLevel.level,
      timerRemainingSecs: nextLevel.durationMinutes * 60,
      timerStartedAt: tournament.timerRunning ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}
```

### 2d. `goBackBlindLevel(tournamentId)`

```typescript
export async function goBackBlindLevel(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const [tournament] = await db
    .select({ currentBlindLevel: tournaments.currentBlindLevel })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) return { error: "Torneio nao encontrado" };

  const blinds = await db
    .select()
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);

  const currentIndex = blinds.findIndex((b) => b.level === tournament.currentBlindLevel);
  const prevLevel = blinds[currentIndex - 1];

  if (!prevLevel) return { error: "Ja esta no primeiro nivel" };

  await db
    .update(tournaments)
    .set({
      currentBlindLevel: prevLevel.level,
      timerRemainingSecs: prevLevel.durationMinutes * 60,
      timerRunning: false,
      timerStartedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}
```

**Nota:** importar `and` de `drizzle-orm` e `blindStructures` de `@/db/schema` no topo do arquivo.

---

## Step 3: Utilitario formatTime

### Arquivo: `src/lib/format.ts` — adicionar

```typescript
export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
```

---

## Step 4: Hooks de Realtime

### 4a. `src/hooks/use-tournament-realtime.ts`

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TournamentRow = {
  id: number;
  currentBlindLevel: number;
  timerRunning: boolean;
  timerRemainingSecs: number | null;
  timerStartedAt: string | null;
  status: string;
  [key: string]: unknown;
};

export function useTournamentRealtime<T extends TournamentRow>(
  tournamentId: number,
  initialData: T
) {
  const [tournament, setTournament] = useState<T>(initialData);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          setTournament((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return tournament;
}
```

### 4b. `src/hooks/use-participants-realtime.ts`

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ParticipantRow = {
  id: number;
  tournamentId: number;
  userId: string;
  status: string;
  [key: string]: unknown;
};

export function useParticipantsRealtime<T extends ParticipantRow>(
  tournamentId: number,
  initialData: T[]
) {
  const [participants, setParticipants] = useState<T>(initialData);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`participants-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setParticipants((prev) => [...prev, payload.new as T]);
          } else if (payload.eventType === "UPDATE") {
            setParticipants((prev) =>
              prev.map((p) => (p.id === (payload.new as T).id ? { ...p, ...payload.new } : p))
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) =>
              prev.filter((p) => p.id !== (payload.old as { id: number }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return participants;
}
```

**Nota:** o hook de participants usa realtime para INSERT/UPDATE/DELETE, mas nao traz o join com `users` (nome/nickname). Para resolver isso, o INSERT via realtime nao tera o nome. Duas opcoes:
1. Fazer um refetch completo da lista via query ao receber qualquer evento (mais simples, menos eficiente)
2. Manter um mapa de users em cache no client

Recomendacao: opcao 1 (refetch) por simplicidade. Mudar o hook para chamar uma funcao de fetch ao receber evento.

### 4c. `src/hooks/use-countdown.ts`

```typescript
"use client";

import { useEffect, useState, useRef } from "react";

interface TimerState {
  timerRunning: boolean;
  timerRemainingSecs: number | null;
  timerStartedAt: string | null;
}

export function useCountdown(timer: TimerState) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => computeRemaining(timer));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (timer.timerRunning && timer.timerStartedAt) {
      // Atualiza imediatamente
      setRemainingSeconds(computeRemaining(timer));

      intervalRef.current = setInterval(() => {
        const remaining = computeRemaining(timer);
        setRemainingSeconds(remaining);

        if (remaining <= 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, 1000);
    } else {
      setRemainingSeconds(timer.timerRemainingSecs ?? 0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer.timerRunning, timer.timerRemainingSecs, timer.timerStartedAt]);

  return {
    remainingSeconds: Math.max(0, remainingSeconds),
    isRunning: timer.timerRunning,
  };
}

function computeRemaining(timer: TimerState): number {
  if (!timer.timerRunning || !timer.timerStartedAt) {
    return timer.timerRemainingSecs ?? 0;
  }
  const elapsed = Math.floor((Date.now() - new Date(timer.timerStartedAt).getTime()) / 1000);
  return (timer.timerRemainingSecs ?? 0) - elapsed;
}
```

---

## Step 5: Componentes Live Table

Todos em `src/components/live-table/`.

### 5a. `timer-display.tsx`

Props: `{ remainingSeconds: number, isRunning: boolean, isBreak: boolean }`

- Renderiza MM:SS em fonte grande (`font-mono text-7xl` para tablets)
- Cor: branco normal, vermelho pulsante (`animate-pulse`) nos ultimos 60 segundos, amarelo/amber durante breaks
- Quando `remainingSeconds === 0` e `isRunning`: flash visual + toca audio `new Audio('/sounds/level-change.mp3').play()`
- Usa `formatTime()` de `src/lib/format.ts`

### 5b. `timer-controls.tsx` (admin only)

Props: `{ tournamentId: number, isRunning: boolean, currentLevel: number, maxLevel: number }`

- Barra de controle com 3 botoes: Play/Pause, Nivel Anterior, Proximo Nivel
- Usa `useTransition` + server actions do Step 2
- Play chama `startTimer`, Pause chama `pauseTimer`
- Anterior chama `goBackBlindLevel`, Proximo chama `advanceBlindLevel`
- Botao Anterior desabilitado no primeiro nivel, Proximo desabilitado no ultimo
- Icones: `Play`, `Pause`, `SkipBack`, `SkipForward` do lucide-react
- Segue padrao de botoes do `participant-list.tsx`

### 5c. `blind-info.tsx`

Props: `{ currentLevel: BlindLevel, nextLevel: BlindLevel | null }`

- Nivel atual em destaque: "Nivel X", "SB: X / BB: Y", "Ante: Z"
- Se `isBreak`: mostra "INTERVALO" com estilo diferenciado (bg-amber)
- Se `isAddonLevel`: badge "ADD-ON DISPONIVEL"
- Abaixo, preview do proximo nivel em texto menor: "Proximo: SB X / BB Y"
- Se nao tem proximo nivel: "Ultimo nivel"

### 5d. `tournament-stats.tsx`

Props: `{ participants: Participant[], tournament: Tournament }`

- Grid de stat cards (2x2 ou 4 em linha no desktop):
  - **Jogadores**: `playing count / total paid count`
  - **Stack medio**: `totalChipsInPlay / playingCount` (usando `formatChips`)
  - **Fichas em jogo**: `(paidPlayers * initialChips) + (totalRebuys * rebuyChips) + (totalAddons * addonChips)`
  - **Prize pool**: calculado ou `prizePoolOverride` (usando `formatCurrency`)

### 5e. `quick-actions.tsx` (admin only)

Props: `{ participants: Participant[], tournamentId: number, tournament: Tournament }`

- Combobox/select para escolher jogador com status "playing"
- Botoes de acao: Eliminar, Rebuy, Add-on
- Rebuy so aparece se `rebuyAmount > 0`
- Add-on so aparece se `allowAddon === true`
- Lista compacta dos ultimos 3 eliminados com botao "Desfazer"
- Reutiliza server actions de `src/actions/participants.ts` (eliminatePlayer, addRebuy, addAddon, undoElimination)
- Usa `useTransition` + `toast` do sonner

### 5f. `mesa-ao-vivo.tsx` (componente orquestrador)

Props: `{ tournament, blindLevels, participants, isAdmin }`

- `"use client"` — componente principal que compoe todos os acima
- Chama `useTournamentRealtime(tournamentId, tournament)`
- Chama `useParticipantsRealtime(tournamentId, participants)`
- Chama `useCountdown(liveTournament)`
- Deriva `currentLevel` e `nextLevel` do array de blinds usando `liveTournament.currentBlindLevel`
- Auto-advance: quando `remainingSeconds === 0` e `isRunning` e `isAdmin`, chama `advanceBlindLevel` (com `useRef` para evitar chamada dupla)
- Layout responsivo:
  - **Desktop/Tablet**: Timer centralizado no topo (dominante), blind info abaixo, stats em row, quick actions em painel lateral ou inferior
  - **Mobile**: Tudo empilhado verticalmente, timer full-width no topo

---

## Step 6: Pagina e Navegacao

### 6a. `src/app/(dashboard)/torneios/[id]/mesa/page.tsx`

```typescript
import { getTournamentById, getBlindStructure } from "@/db/queries/tournaments";
import { getParticipants } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MesaAoVivo } from "@/components/live-table/mesa-ao-vivo";

export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournamentId = Number(id);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.status !== "running") {
    redirect(`/torneios/${tournamentId}`);
  }

  const [blindLevels, participants, financialSummary] = await Promise.all([
    getBlindStructure(tournamentId),
    getParticipants(tournamentId),
    getTournamentFinancialSummary(tournamentId),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <MesaAoVivo
      tournament={tournament}
      blindLevels={blindLevels}
      participants={participants}
      financialSummary={financialSummary}
      isAdmin={isAdmin}
    />
  );
}
```

### 6b. Modificar `src/app/(dashboard)/torneios/[id]/page.tsx`

Adicionar botao/link "Mesa ao Vivo" na barra de acoes do admin, visivel quando `tournament.status === "running"`:

```tsx
{tournament.status === "running" && (
  <Link href={`/torneios/${tournament.id}/mesa`}>
    <Button variant="default">
      <Monitor className="h-4 w-4 mr-2" />
      Mesa ao Vivo
    </Button>
  </Link>
)}
```

Tambem visivel para jogadores (view only, sem controles de admin).

### 6c. Asset de audio

Colocar um arquivo de audio curto em `public/sounds/level-change.mp3` (~1-2 segundos, beep/chime royalty-free).

---

## Decisoes de design

1. **Timer calculado no cliente**: cada cliente calcula o countdown localmente a partir de `timerStartedAt` + `timerRemainingSecs`. Isso evita enviar ticks a cada segundo pelo Realtime e garante sincronia (todos usam a mesma ancora de tempo).

2. **Auto-advance apenas no admin**: quando o timer chega a 0, apenas o cliente admin chama `advanceBlindLevel`. Isso evita race conditions com multiplos clientes tentando avancar. Usa um `useRef` como flag para prevenir chamadas duplas.

3. **Realtime via Supabase postgres_changes**: ao inves de usar Broadcast channels customizados, aproveitamos o postgres_changes que ja eh integrado ao Drizzle/Supabase. Qualquer update no banco via server action automaticamente notifica todos os clientes.

4. **Participants Realtime limitacao**: o realtime envia apenas as colunas da tabela `participants`, sem join com `users`. Para ter nome/nickname, o componente faz refetch da lista completa ao receber evento (simples e confiavel).

5. **goBackBlindLevel pausa o timer**: ao voltar um nivel, o timer sempre pausa para evitar confusao. O admin precisa dar Play manualmente.

6. **Autoplay de audio**: browsers bloqueiam autoplay sem interacao do usuario. O primeiro clique em Play/Pause satisfaz esse requisito. Caso contrario, o som falha silenciosamente (sem erro).

---

## Ordem de execucao sugerida

1. Step 1: habilitar Realtime no Supabase (SQL)
2. Step 3: formatTime (sem dependencias)
3. Step 2: server actions do timer
4. Steps 4a-4c: hooks (realtime + countdown)
5. Steps 5a-5f: componentes live-table
6. Step 6: pagina + navegacao + audio
7. Testes manuais end-to-end

---

## Dependencias

- Torneio precisa estar com status "running" para acessar a mesa
- Blind structure precisa estar configurada no torneio
- Realtime precisa estar habilitado no Supabase (Step 1)
- Participantes precisam ter buy-in confirmado para aparecer como "playing"

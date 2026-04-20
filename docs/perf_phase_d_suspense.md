# Fase D — Suspense + streaming na página do torneio

**Objetivo:** A página `/torneios/[id]` começa a renderizar antes da query mais lenta terminar. Usuário vê skeletons imediatos em vez de tela branca.

**Pré-requisito:** Fases 0, B, C, G. (Com B aplicada, cada seção pode ter seu próprio cache; com D, cada seção renderiza independente.)

---

## Arquivo principal a modificar

- `src/app/(dashboard)/torneios/[id]/page.tsx` — hoje tem 9 queries em `Promise.all` (linhas 40-50).

## Arquivos novos

- `src/components/tournament/sections/financial-section.tsx`
- `src/components/tournament/sections/participant-list-section.tsx`
- `src/components/tournament/sections/blind-levels-section.tsx`
- `src/components/tournament/sections/prize-distribution-section.tsx`
- `src/components/tournament/sections/stats-section.tsx`
- `src/components/tournament/skeletons/financial-skeleton.tsx`
- `src/components/tournament/skeletons/participant-list-skeleton.tsx`
- `src/components/tournament/skeletons/blind-levels-skeleton.tsx`

---

## Estratégia

Transformar `page.tsx` em um **shell**: carrega só o essencial (header com dados básicos do torneio) e delega cada seção pra um Server Component dentro de um `<Suspense>`.

### Antes (pseudocódigo)

```tsx
export default async function Page({ params }: Props) {
  const { id } = await params;
  const [tournament, participants, transactions, financialSummary, blindLevels, prizeStructures, stats, profile, allPlayers] = await Promise.all([
    getTournamentById(id),
    getParticipants(id),
    getTransactions(id),
    getTournamentFinancialSummary(id),
    getBlindStructure(id),
    getPrizeStructures(id),
    getTournamentStats(id),
    getCurrentProfile(),
    getAllPlayers(),
  ]);
  return <div>...render tudo...</div>;
}
```

### Depois

```tsx
import { Suspense } from "react";

export default async function Page({ params }: Props) {
  const { id } = await params;
  const tournament = await getTournamentById(id); // só o header

  return (
    <div>
      <TournamentHeader tournament={tournament} />

      <Suspense fallback={<FinancialSkeleton />}>
        <FinancialSection tournamentId={id} />
      </Suspense>

      <Suspense fallback={<ParticipantListSkeleton />}>
        <ParticipantListSection tournamentId={id} />
      </Suspense>

      <Suspense fallback={<BlindLevelsSkeleton />}>
        <BlindLevelsSection tournamentId={id} />
      </Suspense>

      <Suspense fallback={<PrizeSkeleton />}>
        <PrizeDistributionSection tournamentId={id} />
      </Suspense>
    </div>
  );
}
```

Cada `*Section` é async e faz seu próprio `await` da query que precisa.

**Exemplo (`financial-section.tsx`):**

```tsx
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { FinancialSummary } from "@/components/tournament/financial-summary";

export async function FinancialSection({ tournamentId }: { tournamentId: number }) {
  const summary = await getTournamentFinancialSummary(tournamentId);
  return <FinancialSummary summary={summary} />;
}
```

---

## Passos

1. **Agrupar as 9 queries por seção visual** (olhar o JSX atual da `page.tsx`). Provavelmente:
   - Header: `tournament` (mínimo pra título/status).
   - Financial: `financialSummary`, `transactions`.
   - Participants: `participants`, `allPlayers` (pra dropdown de adicionar).
   - Blind levels: `blindLevels`.
   - Prize: `prizeStructures`.
   - Stats: `tournamentStats`.
   - Auth: `profile` (move pro layout se já não estiver).

2. **Criar os Server Components de seção** em `src/components/tournament/sections/*`. Cada um recebe `tournamentId` (e nada mais) e busca seu dado.

3. **Criar os skeletons** em `src/components/tournament/skeletons/*`. Usar `shadcn/ui` Skeleton.

4. **Reescrever `page.tsx`** como shell com `<Suspense>` por seção.

5. **Mover `profile` pro layout** — se ainda está na page, subir pro layout do `(dashboard)` pra evitar refetch a cada navegação.

6. **Auditar waterfalls** — conferir se alguma seção precisa de dado de outra. Se `ParticipantList` precisa de `tournament.type`, passar como prop do shell, não fazer a seção buscar de novo.

7. **Estado client-side (Fase C)** — `ParticipantListSection` provavelmente ainda precisa passar participantes pra um Client Component com `useOptimistic`. Manter essa fronteira.

---

## Verificação

- Com throttle "Slow 3G": header aparece quase imediato; skeletons preenchem as outras seções; dados chegam em cascata conforme as queries retornam.
- Lighthouse / WebPageTest: **FCP** deve cair (cabeçalho aparece cedo), **LCP** pode subir ou estabilizar.
- Se uma query é lenta (ex: `getTournamentStats` faz agregação pesada), ela não bloqueia mais o resto da página.

---

## Riscos

- **Client Components precisam receber props** — se uma seção hoje é client e busca de server actions, ajustar a fronteira.
- **Perda de consistência entre seções** — se o usuário lê o header (com N participantes) antes da participant list carregar, pode parecer inconsistente por frações de segundo. Para mesa ao vivo, isso é aceitável; se for problema, o `Promise.all` tradicional faz sentido só em algumas páginas.
- **Realtime + Suspense** — ao chegar um evento Realtime que dispara `router.refresh()`, todas as boundaries revalidam. Com cache por tag (Fase B), só as seções afetadas refazem query.

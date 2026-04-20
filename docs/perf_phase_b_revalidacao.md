# Fase B — Invalidação seletiva de cache

**Objetivo:** Reduzir "1 clique = 9 queries" para "1 clique = 1–2 queries".

**Estratégia:** Trocar `revalidatePath("/torneios/{id}", "layout")` por `revalidateTag(...)` granular. Queries lidas na página usam `unstable_cache` com tags específicas, e cada action só invalida as tags realmente afetadas.

**Pré-requisito:** Fase 0 concluída (baseline medido).

---

## Arquivos a modificar

- **Novo:** `src/lib/cache-tags.ts` — helpers de nomenclatura de tags.
- `src/db/queries/participants.ts` — embrulhar queries em `unstable_cache`.
- `src/db/queries/transactions.ts` — idem.
- `src/db/queries/blind-structures.ts` — idem.
- `src/db/queries/tournaments.ts` — idem.
- `src/actions/participants.ts` — substituir `revalidatePath(..., "layout")` por `revalidateTag`.
- `src/actions/tournaments.ts` — mesmo tratamento.

---

## Passo 1 — Helpers de tag

Criar `src/lib/cache-tags.ts`:

```ts
export const tags = {
  participants: (id: number) => `participants-${id}`,
  transactions: (id: number) => `transactions-${id}`,
  financial: (id: number) => `financial-${id}`,
  blind: (id: number) => `blind-${id}`,
  tournament: (id: number) => `tournament-${id}`,
  ranking: () => `ranking`,
};
```

## Passo 2 — Wrapear queries em `unstable_cache`

Para cada query em `src/db/queries/*`, converter pra retornar uma função que usa `unstable_cache` com as tags certas.

**Exemplo (`src/db/queries/participants.ts`):**

```ts
import { unstable_cache } from "next/cache";
import { tags } from "@/lib/cache-tags";

export const getParticipants = (tournamentId: number) =>
  unstable_cache(
    async () => {
      return db.select().from(participants).where(eq(participants.tournamentId, tournamentId));
    },
    [`participants-${tournamentId}`],
    { tags: [tags.participants(tournamentId)], revalidate: 3600 }
  )();
```

**Armadilhas:**
- `unstable_cache` não pode ler `headers()` / `cookies()` dinamicamente. Se alguma query depende de `userId` da sessão, passar o `userId` como parâmetro explícito.
- O primeiro argumento da fn cacheada **deve** incluir tudo que afeta o resultado. Não esqueça `tournamentId` na key.
- `revalidate: 3600` (1h) é só um fallback. A invalidação real vem via `revalidateTag`.

## Passo 3 — Substituir `revalidatePath` pelas tags certas

Mapeamento action → tags a invalidar:

| Action | Tags |
|---|---|
| `confirmBuyIn` | `participants`, `transactions`, `financial` |
| `addRebuy` | `participants`, `transactions`, `financial` |
| `addAddon` | `participants`, `transactions`, `financial` |
| `eliminatePlayer` | `participants` |
| `undoElimination` | `participants` |
| `undoRebuy` | `participants`, `transactions`, `financial` |
| `addParticipant` | `participants` |
| `removeParticipant` | `participants`, `transactions`, `financial` |
| `updateTournamentStatus` | `tournament` (+ `ranking` se status virou `finished`) |
| `startTimer` / `advanceBlindLevel` | `blind` |

**Exemplo (substituição em `confirmBuyIn`):**

```ts
// ANTES
revalidatePath(`/torneios/${tournamentId}`, "layout");

// DEPOIS
import { revalidateTag } from "next/cache";
import { tags } from "@/lib/cache-tags";

revalidateTag(tags.participants(tournamentId));
revalidateTag(tags.transactions(tournamentId));
revalidateTag(tags.financial(tournamentId));
```

## Passo 4 — Deixar `revalidatePath` só onde é necessário

Manter `revalidatePath("/torneios", ...)` apenas em actions que mudam a **lista** de torneios (criar, arquivar, soft-delete). Para mutações dentro de um torneio, usar só tags.

## Passo 5 — Não mexer em `router.refresh()` ainda

Isso vai ser tratado na Fase G. Aqui o objetivo é só parar de invalidar coisas que não mudaram.

---

## Verificação

1. Antes/depois no Network tab após clicar "Confirmar buy-in":
   - Antes: 9 RSC payloads renderizados.
   - Depois: ~2–3 (só as tags afetadas).
2. Em dev, `console.time` em `getBlindStructure` **não deve** aparecer depois de um `confirmBuyIn` (antes aparecia porque layout revalidava tudo).
3. Repetir fluxo de stress da Fase 0 — tempo total deve cair significativamente.

---

## Riscos

- Se alguma query lê dados do usuário corrente via `cookies()`, cache vai vazar entre usuários. **Auditar cada query** antes de aplicar `unstable_cache`.
- `unstable_cache` é API instável do Next.js — checar changelog na versão em uso (se estiver em Next 15+, pode ter `use cache` / `cacheTag` mais novos).
- Se o projeto já usa ISR/SSG na página do torneio, conferir interação com `revalidate: 3600`.

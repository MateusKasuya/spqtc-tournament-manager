# Fase C — Optimistic UI

**Objetivo:** UI responde em <16ms mesmo que o servidor demore. Acabar com a sensação de "clique travado".

**Pré-requisito:** Fases 0 e B concluídas.

---

## Arquivos a modificar

- `src/components/live-table/quick-actions.tsx` — rebuy, add-on, eliminar, bounty collect.
- `src/components/tournament/participant-list.tsx` — confirmBuyIn, remove.
- `src/components/tournament/payout-dialog.tsx` — confirmar payout.

---

## Padrão a aplicar

React 19 / Next 15 oferece `useOptimistic` + `useTransition`. Padrão geral:

```tsx
"use client";
import { useOptimistic, useTransition } from "react";

type OptimisticUpdate = { id: number; change: Partial<Participant> };

export function QuickActions({ participants }: { participants: Participant[] }) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(
    participants,
    (state: Participant[], update: OptimisticUpdate) =>
      state.map(p => p.id === update.id ? { ...p, ...update.change } : p)
  );

  function handleRebuy(p: Participant) {
    startTransition(async () => {
      addOptimistic({ id: p.id, change: { rebuyCount: p.rebuyCount + 1 } });
      const result = await addRebuyAction(p.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao adicionar rebuy");
      }
    });
  }

  return (
    <div>
      {optimistic.map(p => (
        <Row key={p.id} p={p} onRebuy={() => handleRebuy(p)} pending={isPending} />
      ))}
    </div>
  );
}
```

---

## Passos

1. **Elevar estado** — `participants` precisa estar no componente que vai ter `useOptimistic`. Se hoje cada linha pega sua própria prop, subir o estado para o pai.

2. **Mapear cada ação → mudança visual imediata:**
   | Action | Mudança otimista |
   |---|---|
   | `confirmBuyIn` | `buyInPaid: true` |
   | `addRebuy` | `rebuyCount + 1` |
   | `addAddon` | `addonUsed: true` |
   | `eliminatePlayer` | `status: "eliminated"`, `eliminatedAt: now` |
   | `undoElimination` | `status: "playing"`, `eliminatedAt: null` |
   | `removeParticipant` | filtra do array |
   | `addParticipant` | adiciona ao array com id negativo temporário |

3. **Adicionar `useOptimistic`** em cada componente listado, seguindo o padrão acima.

4. **Tratar erro** — `useOptimistic` reverte automaticamente quando a transition termina (o state base vira a verdade de novo). Mas o usuário precisa saber que falhou — mostrar `toast.error`.

5. **Decidir o que NÃO é otimista:**
   - **Payout final** (`payout-dialog.tsx`) — envolve dinheiro, usuário precisa confirmação real.
   - **Undos complexos** (`undoRebuy` com bounty) — muita lógica de reverter, erro de estimativa causa mais confusão.
   - Nesses casos, manter o padrão atual com spinner.

6. **Bounty (migration 0012)** — no modo bounty, clicar "Eliminar" também atualiza `currentBounty` de outro participante. A atualização otimista precisa refletir isso. Exemplo:
   ```ts
   addOptimistic({ id: eliminated.id, change: { status: "eliminated" } });
   addOptimistic({ id: eliminator.id, change: { currentBounty: eliminator.currentBounty + bountyAmount, bountiesCollected: eliminator.bountiesCollected + 1 } });
   ```

---

## Verificação

- Clicar "Rebuy" → contador incrementa **antes** de o request terminar.
- DevTools → Network → Throttle "Slow 3G" → UI ainda responde instantaneamente.
- Desligar a internet → clicar "Rebuy" → UI incrementa, depois de X segundos reverte + toast de erro.
- Mesa ao vivo em dois dispositivos: A faz rebuy, B vê o contador atualizar via Realtime (Fase G vai cuidar de não duplicar).

---

## Riscos

- **Divergência com realidade:** se a lógica do servidor rejeita (ex: torneio terminou, rebuy não permitido), otimista precisa reverter limpo. Toast de erro é obrigatório.
- **IDs temporários para novos itens:** ao adicionar participante, id vem do servidor. Usar `id: -Date.now()` temporário e trocar quando a action retornar.
- **Re-renders em massa:** `useOptimistic` re-renderiza a lista toda a cada update. Se a lista for grande (>100 linhas), memoizar `Row` com `React.memo`.

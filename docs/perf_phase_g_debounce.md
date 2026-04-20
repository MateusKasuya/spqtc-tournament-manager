# Fase G — Debounce do realtime + evitar refresh duplicado

**Objetivo:** Evitar que ações locais disparem dois refreshes — um da server action, outro do Supabase Realtime que detecta a mudança.

**Pré-requisito:** Fase 0 + preferencialmente B e C.

---

## Problema

Fluxo atual da mesa ao vivo:

1. Admin clica "Eliminar jogador".
2. Server action executa → `revalidatePath`/`revalidateTag` → cliente faz `router.refresh()`.
3. Supabase Realtime detecta UPDATE na tabela → hook `use-participants-realtime` chama `router.refresh()` **de novo**.

Resultado: dois ciclos de RSC por clique. Com 3 cliques rápidos, fica 6 refreshes em fila.

---

## Arquivos a modificar

- `src/hooks/use-participants-realtime.ts`
- `src/hooks/use-tournament-realtime.ts`
- `src/components/live-table/quick-actions.tsx` (e outros componentes que chamam `router.refresh()` após action)
- **Novo:** `src/hooks/use-local-refresh.ts` (helper compartilhado)

---

## Estratégia

Guardar timestamp do último `router.refresh()` local. Se o evento do Realtime chegar dentro de uma janela (ex: 800ms) após um refresh local, ignorar o refresh remoto — a mudança já foi refletida localmente.

---

## Implementação

### Opção A — Event global (mais simples)

Criar `src/hooks/use-local-refresh.ts`:

```ts
"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const LOCAL_REFRESH_EVENT = "app:local-refresh";
const IGNORE_WINDOW_MS = 800;

export function useLocalRefresh() {
  const router = useRouter();
  return useCallback(() => {
    window.dispatchEvent(new CustomEvent(LOCAL_REFRESH_EVENT));
    router.refresh();
  }, [router]);
}

export function useRealtimeRefresh() {
  const router = useRouter();
  const lastLocal = useRef(0);

  useEffect(() => {
    const onLocal = () => { lastLocal.current = Date.now(); };
    window.addEventListener(LOCAL_REFRESH_EVENT, onLocal);
    return () => window.removeEventListener(LOCAL_REFRESH_EVENT, onLocal);
  }, []);

  return useCallback(() => {
    if (Date.now() - lastLocal.current < IGNORE_WINDOW_MS) return;
    router.refresh();
  }, [router]);
}
```

**Uso:**

```tsx
// quick-actions.tsx
const refresh = useLocalRefresh();
// ...ao fim da action:
refresh();  // substituir router.refresh()

// use-participants-realtime.ts
const refresh = useRealtimeRefresh();
channel.on("postgres_changes", { /* ... */ }, () => {
  refresh();  // substituir router.refresh()
});
```

### Opção B — Context (mais estruturada)

Se preferir evitar `window.dispatchEvent`, criar `RealtimeContext` que expõe os mesmos dois hooks. Funcionalmente idêntico.

---

## Passos

1. Criar `src/hooks/use-local-refresh.ts` com os dois hooks.
2. Em `src/components/live-table/quick-actions.tsx`: trocar `router.refresh()` por `useLocalRefresh()`.
3. Repetir em todo componente que chama `router.refresh()` após uma mutation (grep `router.refresh` pra achar todos).
4. Em `src/hooks/use-participants-realtime.ts` e `use-tournament-realtime.ts`: trocar `router.refresh()` por `useRealtimeRefresh()`.
5. Validar com 2 abas abertas na mesa ao vivo.

---

## Verificação

- Aba única: clicar "Confirmar buy-in" → **1** refresh RSC na Network (não 2).
- Dois dispositivos na mesa ao vivo: A faz ação, B vê atualização via Realtime sem atraso extra.
- 3 cliques rápidos → 3 refreshes totais (não 6).

---

## Riscos

- **Janela muito curta** → refresh remoto legítimo é bloqueado por engano. 800ms é conservador pro round-trip + propagação do Realtime.
- **Janela muito longa** → atrasa sincronização multi-dispositivo.
- Se muitos dispositivos fazem ações em paralelo, ajustar a janela. Alternativa: comparar payload do evento Realtime com último estado conhecido e só refresh se diferente.

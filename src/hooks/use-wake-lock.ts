"use client";

import { useEffect } from "react";

// Mantém a tela ligada enquanto `enabled` for true (ex.: timer rodando), pra o
// som de virada de blind não ser perdido quando o celular bloquearia sozinho.
// No-op em SSR e em navegadores sem suporte (iOS < 16.4). O sentinel é liberado
// automaticamente pelo navegador quando a aba fica oculta, então re-adquirimos
// no retorno do background via `visibilitychange` (mesmo padrão de
// use-tournament-realtime.ts).
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        sentinel.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // sem suporte / negado / sem gesto do usuário — ignora silenciosamente
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel) {
        void sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [enabled]);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Mantém participantes + resumo financeiro da mesa em estado local no cliente,
// alimentados por um refetch leve e coalescido — mesmo padrão do useTournamentRealtime.
// Substitui o antigo modelo de router.refresh() por ação, que re-renderizava toda a
// página (force-dynamic) e empilhava transitions, congelando a UI em ações rápidas.
export function useMesaData<P, F>(
  tournamentId: number,
  initialParticipants: P[],
  initialFinancialSummary: F,
  fetcher: () => Promise<{ participants: P[]; financialSummary: F }>
) {
  const [participants, setParticipants] = useState<P[]>(initialParticipants);
  const [financialSummary, setFinancialSummary] = useState<F>(initialFinancialSummary);

  // Guarda o fetcher mais recente sem re-disparar a subscription (que depende só de tournamentId).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Re-semeia com o snapshot fresco do servidor sempre que as props mudarem
  // (F5/navegação). O servidor é a fonte da verdade pós-revalidatePath; eventos
  // realtime posteriores continuam atualizando via refetch.
  useEffect(() => {
    setParticipants(initialParticipants);
  }, [initialParticipants]);
  useEffect(() => {
    setFinancialSummary(initialFinancialSummary);
  }, [initialFinancialSummary]);

  // Coalescing: no máximo um fetch em voo. Pedidos que chegam durante o voo marcam
  // pendingRef e disparam uma única re-execução ao final — bursts de N ações colapsam
  // para ~1-2 fetches sequenciais em vez de N. refetch nunca rejeita (a UI não pode travar).
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);
  const cancelledRef = useRef(false);

  const refetch = useCallback((): Promise<void> => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }
    const run = (async () => {
      do {
        pendingRef.current = false;
        try {
          const data = await fetcherRef.current();
          if (!cancelledRef.current) {
            setParticipants(data.participants);
            setFinancialSummary(data.financialSummary);
          }
        } catch (e) {
          // Falha de refetch não deve congelar a UI; realtime/visibilitychange retentam.
          console.error("useMesaData refetch falhou", e);
          break;
        }
      } while (pendingRef.current && !cancelledRef.current);
    })().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
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
        () => {
          void refetch();
        }
      )
      .subscribe((status) => {
        // Fecha a janela entre o SSR e o SUBSCRIBED e cobre reconexão automática
        // do supabase-js (CHANNEL_ERROR/TIMED_OUT → SUBSCRIBED de novo).
        if (status === "SUBSCRIBED") {
          void refetch();
        }
      });

    // Catch-all confiável ao voltar do background (aba inativa / tela bloqueada).
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, refetch]);

  return { participants, financialSummary, refetch };
}

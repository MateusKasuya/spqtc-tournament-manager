"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyTournamentEvent, TOURNAMENT_RAW_COLUMNS } from "@/lib/mesa-snapshot";
import { getMesaLiveData } from "@/actions/mesa";
import type { MesaSnapshot } from "@/db/queries/mesa";

const TOURNAMENT_SELECT = TOURNAMENT_RAW_COLUMNS.join(", ");

// Mantém o snapshot da mesa em dia no cliente, com duas estratégias:
// - UPDATE do torneio (Relógio, Status, configuração) aplicado direto do evento,
//   sem nova busca, para o Relógio não engasgar;
// - mudança em participantes dispara nova busca da parte ao vivo, coalescida.
export function useMesaSnapshot(initial: MesaSnapshot) {
  const tournamentId = initial.tournament.id;
  const [tournament, setTournament] = useState(initial.tournament);
  const [live, setLive] = useState({
    participants: initial.participants,
    financialSummary: initial.financialSummary,
  });

  // Re-semeia com o snapshot fresco do servidor sempre que ele mudar (F5,
  // router.refresh() após actions do Relógio). O servidor é a fonte da verdade.
  useEffect(() => {
    setTournament(initial.tournament);
    setLive({ participants: initial.participants, financialSummary: initial.financialSummary });
  }, [initial]);

  // Coalescing: no máximo uma busca em voo. Pedidos que chegam durante o voo marcam
  // pendingRef e disparam uma única re-execução ao final — bursts de N ações colapsam
  // para ~1-2 buscas sequenciais em vez de N. refetch nunca rejeita (a UI não pode travar).
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);
  const cancelledRef = useRef(false);
  // Conta os eventos do torneio aplicados: uma ressincronização que termina depois
  // de um evento mais novo é descartada, para não voltar o Relógio.
  const tournamentEventsRef = useRef(0);

  const refetch = useCallback((): Promise<void> => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }
    const run = (async () => {
      do {
        pendingRef.current = false;
        try {
          const data = await getMesaLiveData(tournamentId);
          if (!cancelledRef.current) setLive(data);
        } catch (e) {
          // Falha de busca não deve congelar a UI; realtime/visibilitychange retentam.
          console.error("useMesaSnapshot refetch falhou", e);
          break;
        }
      } while (pendingRef.current && !cancelledRef.current);
    })().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = run;
    return run;
  }, [tournamentId]);

  useEffect(() => {
    cancelledRef.current = false;
    const supabase = createClient();

    const resyncTournament = async () => {
      const eventsAtStart = tournamentEventsRef.current;
      const { data, error } = await supabase
        .from("tournaments")
        .select(TOURNAMENT_SELECT)
        .eq("id", tournamentId)
        .single();
      if (cancelledRef.current || error || !data) return;
      if (tournamentEventsRef.current !== eventsAtStart) return;
      tournamentEventsRef.current++;
      setTournament((prev) => applyTournamentEvent(prev, data as unknown as Record<string, unknown>));
    };

    const resyncAll = () => {
      void resyncTournament();
      void refetch();
    };

    const channel = supabase
      .channel(`mesa-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          if (cancelledRef.current) return;
          tournamentEventsRef.current++;
          setTournament((prev) => applyTournamentEvent(prev, payload.new));
        }
      )
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
        if (status === "SUBSCRIBED") resyncAll();
      });

    // Catch-all ao voltar do background (aba inativa, tela bloqueada no mobile):
    // o supabase-js pode não notar a queda da conexão.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resyncAll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, refetch]);

  const snapshot = useMemo(
    () => ({ ...initial, tournament, ...live }),
    [initial, tournament, live]
  );

  return { snapshot, refetch };
}

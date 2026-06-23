"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TournamentTimerFields = {
  id: number;
  currentBlindLevel: number;
  timerRunning: boolean;
  timerRemainingSecs: number | null;
  timerStartedAt: Date | string | null;
  status: string;
  breakActive: boolean;
  breakTotalSecs: number | null;
};

type TournamentRow = {
  current_blind_level: number;
  timer_running: boolean;
  timer_remaining_secs: number | null;
  timer_started_at: string | null;
  status: string;
  break_active: boolean;
  break_total_secs: number | null;
};

function mapRow<T extends TournamentTimerFields>(prev: T, row: Partial<TournamentRow>): T {
  return {
    ...prev,
    currentBlindLevel: row.current_blind_level ?? prev.currentBlindLevel,
    timerRunning: row.timer_running ?? prev.timerRunning,
    timerRemainingSecs:
      row.timer_remaining_secs !== undefined ? row.timer_remaining_secs : prev.timerRemainingSecs,
    timerStartedAt:
      row.timer_started_at !== undefined ? row.timer_started_at : prev.timerStartedAt,
    status: row.status ?? prev.status,
    breakActive: row.break_active !== undefined ? row.break_active : prev.breakActive,
    breakTotalSecs:
      row.break_total_secs !== undefined ? row.break_total_secs : prev.breakTotalSecs,
  };
}

const TIMER_COLUMNS =
  "id, current_blind_level, timer_running, timer_remaining_secs, timer_started_at, status, break_active, break_total_secs";

export function useTournamentRealtime<T extends TournamentTimerFields>(
  tournamentId: number,
  initialData: T
) {
  const [tournament, setTournament] = useState<T>(initialData);

  // Sincroniza com snapshot fresco do servidor sempre que initialData mudar
  // (F5, router.refresh() após server actions). O servidor é a fonte da verdade
  // pós-revalidatePath; eventos realtime posteriores continuam atualizando normalmente.
  useEffect(() => {
    setTournament(initialData);
  }, [initialData]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refetch = async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select(TIMER_COLUMNS)
        .eq("id", tournamentId)
        .single();
      if (cancelled || error || !data) return;
      setTournament((prev) => mapRow(prev, data as Partial<TournamentRow>));
    };

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
          if (cancelled) return;
          const raw = payload.new as Partial<TournamentRow>;
          setTournament((prev) => mapRow(prev, raw));
        }
      )
      .subscribe((status) => {
        // Fecha a janela entre SSR fetch e SUBSCRIBED: garante que qualquer
        // UPDATE perdido durante o setup do canal seja capturado pelo refetch.
        // Também cobre reconexão automática do supabase-js (CHANNEL_ERROR/TIMED_OUT
        // → SUBSCRIBED de novo dispara este refetch).
        if (status === "SUBSCRIBED") {
          void refetch();
        }
      });

    // Refetch ao voltar do background (aba inativa, tela bloqueada no mobile):
    // o supabase-js pode não notar a queda da conexão; este é o catch-all confiável.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return tournament;
}

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
};

export function useTournamentRealtime<T extends TournamentTimerFields>(
  tournamentId: number,
  initialData: T
) {
  const [tournament, setTournament] = useState<T>(initialData);

  // Sincroniza quando o servidor re-renderiza (ex: após router.refresh())
  useEffect(() => {
    setTournament(initialData);
  }, [initialData]);

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
          console.log("[realtime] tournament update received", payload.new);
          const raw = payload.new as Record<string, unknown>;
          setTournament((prev) => ({
            ...prev,
            currentBlindLevel: (raw.current_blind_level as number) ?? prev.currentBlindLevel,
            timerRunning: (raw.timer_running as boolean) ?? prev.timerRunning,
            timerRemainingSecs: raw.timer_remaining_secs !== undefined
              ? (raw.timer_remaining_secs as number | null)
              : prev.timerRemainingSecs,
            timerStartedAt: raw.timer_started_at !== undefined
              ? (raw.timer_started_at as string | null)
              : prev.timerStartedAt,
            status: (raw.status as string) ?? prev.status,
          }));
        }
      )
      .subscribe((status) => {
        console.log("[realtime] subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return tournament;
}

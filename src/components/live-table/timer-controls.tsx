"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, SkipBack, SkipForward, Coffee } from "lucide-react";
import { startTimer, pauseTimer, advanceBlindLevel, goBackBlindLevel, startBreak, endBreak } from "@/actions/tournaments";
import { playLevelSound } from "@/lib/play-level-sound";
import { toast } from "sonner";

interface TimerControlsProps {
  tournamentId: number;
  isRunning: boolean;
  currentLevelIndex: number;
  totalLevels: number;
  breakActive: boolean;
}

export function TimerControls({
  tournamentId,
  isRunning,
  currentLevelIndex,
  totalLevels,
  breakActive,
}: TimerControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [showBreakOptions, setShowBreakOptions] = useState(false);
  const router = useRouter();

  function run(action: () => Promise<{ error?: string } | { success: boolean } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (breakActive) {
    return (
      <button
        type="button"
        onClick={() => { playLevelSound(); run(() => endBreak(tournamentId)); }}
        disabled={isPending}
        className="rounded-md border border-amber-400 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 disabled:opacity-40 disabled:pointer-events-none"
      >
        Encerrar intervalo
      </button>
    );
  }

  if (showBreakOptions) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground">Duração do intervalo:</p>
        <div className="flex items-center gap-2">
          {[5, 10, 15].map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => {
                setShowBreakOptions(false);
                run(() => startBreak(tournamentId, min));
              }}
              disabled={isPending}
              className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40"
            >
              {min} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowBreakOptions(false)}
            disabled={isPending}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => run(() => goBackBlindLevel(tournamentId))}
          disabled={isPending || currentLevelIndex <= 0}
          className="inline-flex items-center justify-center rounded-full border p-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
          title="Nivel anterior"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => run(() => isRunning ? pauseTimer(tournamentId) : startTimer(tournamentId))}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground p-4 transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
          title={isRunning ? "Pausar" : "Iniciar"}
        >
          {isRunning ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </button>

        <button
          type="button"
          onClick={() => { playLevelSound(); run(() => advanceBlindLevel(tournamentId)); }}
          disabled={isPending || currentLevelIndex >= totalLevels - 1}
          className="inline-flex items-center justify-center rounded-full border p-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
          title="Proximo nivel"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowBreakOptions(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
      >
        <Coffee className="h-3.5 w-3.5" />
        Intervalo
      </button>
    </div>
  );
}

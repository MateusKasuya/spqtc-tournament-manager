"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { startTimer, pauseTimer, advanceBlindLevel, goBackBlindLevel } from "@/actions/tournaments";
import { playLevelSound } from "@/lib/play-level-sound";
import { toast } from "sonner";

interface TimerControlsProps {
  tournamentId: number;
  isRunning: boolean;
  currentLevelIndex: number;
  totalLevels: number;
}

export function TimerControls({
  tournamentId,
  isRunning,
  currentLevelIndex,
  totalLevels,
}: TimerControlsProps) {
  const [isPending, startTransition] = useTransition();
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

  return (
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
  );
}

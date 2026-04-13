"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause } from "lucide-react";
import { formatTime, formatChips } from "@/lib/format";
import { startTimer, pauseTimer } from "@/actions/tournaments";
import { toast } from "sonner";

interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  isBreak: boolean;
}

interface StickyTimerBarProps {
  remainingSeconds: number;
  isRunning: boolean;
  isBreak: boolean;
  currentLevel: BlindLevel;
  isAdmin: boolean;
  tournamentId: number;
  onScrollBack: () => void;
}

export function StickyTimerBar({
  remainingSeconds,
  isRunning,
  isBreak,
  currentLevel,
  isAdmin,
  tournamentId,
  onScrollBack,
}: StickyTimerBarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isWarning = !isBreak && remainingSeconds > 0 && remainingSeconds <= 60;
  const isEmpty = remainingSeconds === 0 && isRunning;

  const timeColorClass = isBreak
    ? "text-amber-400"
    : isEmpty
    ? "text-red-500 animate-pulse"
    : isWarning
    ? "text-red-400 animate-pulse"
    : "text-foreground";

  function handlePlayPause(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const action = isRunning ? pauseTimer : startTimer;
      const result = await action(tournamentId);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b bg-background/90 backdrop-blur-sm shadow-sm animate-in slide-in-from-top duration-200">
      <div
        className="flex items-center justify-between gap-3 max-w-2xl mx-auto px-4 py-2 cursor-pointer"
        onClick={onScrollBack}
      >
        <span className={`font-mono text-lg font-bold tabular-nums shrink-0 ${timeColorClass}`}>
          {formatTime(remainingSeconds)}
        </span>

        <span className="text-sm text-muted-foreground truncate text-center">
          {isBreak ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">INTERVALO</span>
          ) : (
            <>
              Nível {currentLevel.level}: {formatChips(currentLevel.smallBlind)} / {formatChips(currentLevel.bigBlind)}
              {currentLevel.ante > 0 && ` / ${formatChips(currentLevel.ante)}`}
            </>
          )}
        </span>

        {isAdmin ? (
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground p-1.5 shrink-0 transition-colors hover:bg-primary/90 disabled:opacity-40"
            title={isRunning ? "Pausar" : "Iniciar"}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-7 shrink-0" />
        )}
      </div>
    </div>
  );
}

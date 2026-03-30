"use client";

import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/format";
import { playLevelSound } from "@/lib/play-level-sound";

interface TimerDisplayProps {
  remainingSeconds: number;
  isRunning: boolean;
  isBreak: boolean;
  totalSeconds: number;
}

export function TimerDisplay({ remainingSeconds, isRunning, isBreak, totalSeconds }: TimerDisplayProps) {
  const hasAlertedRef = useRef(false);

  useEffect(() => {
    if (remainingSeconds === 0 && isRunning && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      playLevelSound();
    }
    if (remainingSeconds > 0) {
      hasAlertedRef.current = false;
    }
  }, [remainingSeconds, isRunning]);

  const isWarning = !isBreak && remainingSeconds > 0 && remainingSeconds <= 60;
  const isEmpty = remainingSeconds === 0 && isRunning;

  const colorClass = isBreak
    ? "text-amber-400"
    : isEmpty
    ? "text-red-500 animate-pulse"
    : isWarning
    ? "text-red-400 animate-pulse"
    : "text-foreground";

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const r = 88;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        <svg
          className="absolute inset-0 -rotate-90"
          width="200"
          height="200"
          viewBox="0 0 200 200"
        >
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-muted/20"
          />
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={isBreak ? "text-amber-400" : isWarning || isEmpty ? "text-red-400" : "text-primary"}
            style={{ transition: "stroke-dashoffset 1s linear" }}
            suppressHydrationWarning
          />
        </svg>
        <span suppressHydrationWarning className={`font-mono text-5xl font-bold tabular-nums ${colorClass}`}>
          {formatTime(remainingSeconds)}
        </span>
      </div>
    </div>
  );
}

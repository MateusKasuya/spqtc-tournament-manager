"use client";

import { formatTime } from "@/lib/format";
import type { ClockTone } from "@/lib/tournament-clock";
import { TIMER_TEXT_COLOR_CLASS } from "./timer-tone-classes";

interface TimerDisplayProps {
  remainingSeconds: number;
  tone: ClockTone;
  totalSeconds: number;
}

const RING_COLOR_CLASS: Record<ClockTone, string> = {
  break: "text-amber-400",
  zero: "text-red-400",
  warning: "text-red-400",
  normal: "text-primary",
};

export function TimerDisplay({ remainingSeconds, tone, totalSeconds }: TimerDisplayProps) {
  const colorClass = TIMER_TEXT_COLOR_CLASS[tone];

  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
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
            className={RING_COLOR_CLASS[tone]}
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

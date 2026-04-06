"use client";

import { useEffect, useState, useRef } from "react";

interface TimerState {
  timerRunning: boolean;
  timerRemainingSecs: number | null;
  timerStartedAt: Date | string | null;
}

function computeRemaining(timer: TimerState): number {
  if (!timer.timerRunning || !timer.timerStartedAt) {
    return timer.timerRemainingSecs ?? 0;
  }
  const startMs =
    timer.timerStartedAt instanceof Date
      ? timer.timerStartedAt.getTime()
      : new Date(timer.timerStartedAt).getTime();
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  return (timer.timerRemainingSecs ?? 0) - elapsed;
}

export function useCountdown(timer: TimerState) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, computeRemaining(timer))
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (timer.timerRunning && timer.timerStartedAt) {
      setRemainingSeconds(Math.max(0, computeRemaining(timer)));

      intervalRef.current = setInterval(() => {
        const remaining = computeRemaining(timerRef.current);
        setRemainingSeconds(Math.max(0, remaining));

        if (remaining <= 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, 1000);
    } else {
      setRemainingSeconds(Math.max(0, timer.timerRemainingSecs ?? 0));
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.timerRunning, timer.timerRemainingSecs, timer.timerStartedAt]);

  return {
    remainingSeconds,
    isRunning: timer.timerRunning,
  };
}

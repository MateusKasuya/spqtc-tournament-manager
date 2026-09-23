"use client";

import { useEffect, useState, useRef } from "react";
import { remainingSecs, toIsoOrNull, type ClockState } from "@/lib/tournament-clock";

type TimerState = Pick<ClockState, "timerRunning" | "timerRemainingSecs" | "timerStartedAt">;

export function useCountdown(timer: TimerState) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => remainingSecs(timer, new Date()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (timer.timerRunning && timer.timerStartedAt) {
      setRemainingSeconds(remainingSecs(timer, new Date()));

      intervalRef.current = setInterval(() => {
        const remaining = remainingSecs(timerRef.current, new Date());
        setRemainingSeconds(remaining);

        if (remaining <= 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, 1000);
    } else {
      setRemainingSeconds(remainingSecs(timer, new Date()));
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // timerStartedAt vira uma nova instância de Date a cada linha crua do
  // realtime; comparar pelo ISO evita resetar o interval quando o instante
  // gravado na verdade não mudou.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.timerRunning, timer.timerRemainingSecs, toIsoOrNull(timer.timerStartedAt)]);

  return {
    remainingSeconds,
    isRunning: timer.timerRunning,
  };
}

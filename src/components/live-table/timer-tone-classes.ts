import type { ClockTone } from "@/lib/tournament-clock";

// Compartilhado entre o painel principal e a barra fixa do topo para que a
// cor de aviso do Tempo restante nunca discorde entre as duas telas.
export const TIMER_TEXT_COLOR_CLASS: Record<ClockTone, string> = {
  break: "text-amber-400",
  zero: "text-red-500 animate-pulse",
  warning: "text-red-400 animate-pulse",
  normal: "text-foreground",
};

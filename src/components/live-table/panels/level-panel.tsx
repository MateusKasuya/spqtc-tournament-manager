import type { LevelSlice } from "@/lib/mesa-panels";

// Painel Nível: recebe o modelo da derivação e só desenha. Enquanto a derivação
// devolve `panel: null`, não há nada para desenhar.
export function LevelPanel({ panel }: { panel: LevelSlice["panel"] }) {
  return panel;
}

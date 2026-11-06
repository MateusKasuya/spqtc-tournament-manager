import type { AverageStackSlice } from "@/lib/mesa-panels";

// Painel Stack médio: recebe o modelo da derivação e só desenha. Enquanto a derivação
// devolve `panel: null`, não há nada para desenhar.
export function AverageStackPanel({ panel }: { panel: AverageStackSlice["panel"] }) {
  return panel;
}

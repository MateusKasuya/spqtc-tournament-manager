import type { PrizePoolSlice } from "@/lib/mesa-panels";

// Painel Prize pool: recebe o modelo da derivação e só desenha. Enquanto a derivação
// devolve `panel: null`, não há nada para desenhar.
export function PrizePoolPanel({ panel }: { panel: PrizePoolSlice["panel"] }) {
  return panel;
}

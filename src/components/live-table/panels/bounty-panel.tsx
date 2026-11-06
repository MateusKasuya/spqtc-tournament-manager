import type { BountySlice } from "@/lib/mesa-panels";

// Painel Bounty em jogo: recebe o modelo da derivação e só desenha. Enquanto a derivação
// devolve `panel: null`, não há nada para desenhar.
export function BountyPanel({ panel }: { panel: BountySlice["panel"] }) {
  return panel;
}

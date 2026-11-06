import type { PlayersSlice } from "@/lib/mesa-panels";

// Painel Jogadores: recebe o modelo da derivação e só desenha. Enquanto a derivação
// devolve `panel: null`, não há nada para desenhar.
export function PlayersPanel({ panel }: { panel: PlayersSlice["panel"] }) {
  return panel;
}

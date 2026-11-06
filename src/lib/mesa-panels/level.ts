import type { MesaPanelsInput } from "./types";

// O painel Nível abre pelo bloco do Nível e dos blinds, não por um card.
export interface LevelSlice {
  // Painel ainda não construído (spec #75): o bloco do Nível não abre gaveta.
  panel: null;
}

export function deriveLevel(input: MesaPanelsInput): LevelSlice {
  void input;
  return { panel: null };
}

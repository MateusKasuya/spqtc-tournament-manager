import type { MesaPanelsInput } from "./types";

// O painel Nível abre pelo bloco do Nível e dos blinds, não por um card.
export interface LevelSlice {
  panel: null;
}

export const deriveLevel: (input: MesaPanelsInput) => LevelSlice = () => ({ panel: null });

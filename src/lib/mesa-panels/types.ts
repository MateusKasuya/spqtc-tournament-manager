import type { MesaSnapshot } from "@/db/queries/mesa";

// Os seis painéis da Mesa ao vivo (spec #75). Cada um tem a própria derivação,
// num arquivo deste diretório, e o próprio componente de painel.
export const MESA_PANEL_IDS = ["players", "averageStack", "chipsInPlay", "prizePool", "bounty", "level"] as const;

export type MesaPanelId = (typeof MESA_PANEL_IDS)[number];

export interface MesaPanelsInput {
  snapshot: MesaSnapshot;
  // Tempo restante do Relógio, em segundos, como a mesa o mostra agora.
  remainingSeconds: number;
  isAdmin: boolean;
}

// Face de um card de estatística, já pronta para desenhar.
export interface CardFace {
  label: string;
  value: string;
  // Linhas de apoio abaixo do valor, na ordem em que aparecem; vazia quando não há.
  supportLines: string[];
}

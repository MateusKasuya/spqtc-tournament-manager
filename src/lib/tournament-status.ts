// Regra do Status do torneio (CONTEXT.md): em que status cada grupo de ações
// pode rodar, com uma única mensagem de recusa por grupo.

import type { tournaments } from "@/db/schema";

export type TournamentStatus = (typeof tournaments.$inferSelect)["status"];

export interface StatusRule {
  allowed: readonly TournamentStatus[];
  error: string;
}

export const STATUS_RULES = {
  // Inscrever/remover participante e confirmar/desfazer buy-in.
  registration: {
    allowed: ["pending", "running"],
    error: "Inscricoes e buy-ins so com o torneio pendente ou rodando",
  },
  // Relógio, Knockout, Rebuy, add-on, bônus e Desfazer.
  live: {
    allowed: ["running"],
    error: "Acao disponivel so com o torneio rodando",
  },
  payouts: {
    allowed: ["running", "finished"],
    error: "Premios so podem ser distribuidos com o torneio rodando ou encerrado",
  },
  // Estruturas de blinds e de prêmios.
  structures: {
    allowed: ["pending", "running"],
    error: "Estruturas so podem ser editadas com o torneio pendente ou rodando",
  },
} as const satisfies Record<string, StatusRule>;

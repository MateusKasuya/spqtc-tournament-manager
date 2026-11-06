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
  // Dados do torneio: nome, data, temporada, limite de Rebuys e permissao de
  // add-on.
  tournamentData: {
    allowed: ["pending", "running"],
    error: "Torneio so pode ser editado com o torneio pendente ou rodando",
  },
  // Fichas (iniciais, de Rebuy, de add-on, de bonus): nao sao guardadas por entrada.
  chips: {
    allowed: ["pending"],
    error: "Fichas so podem ser alteradas com o torneio pendente",
  },
  // Valores de buy-in, Rebuy e add-on, taxa de ranking, tipo e percentual de
  // Bounty. Alem do Status, exigem que nenhum buy-in tenha sido confirmado: o
  // Bounty inicial e fixado no buy-in, e as telas de total pago multiplicam os
  // valores do torneio pelas contagens de cada participante. O valor do add-on
  // fica livre enquanto o add-on nao e permitido e ninguem fez add-on.
  entryRules: {
    allowed: ["pending"],
    error:
      "Valores de buy-in, Rebuy e add-on, taxa de ranking, tipo e percentual de Bounty so podem ser alterados com o torneio pendente",
  },
} as const satisfies Record<string, StatusRule>;

// Transições do Status do torneio (CONTEXT.md): Encerrado e Cancelado são
// finais; Rodando não volta a Pendente. Re-encerrar um torneio Encerrado é
// tratado à parte por quem aplica a transição.
export const TOURNAMENT_STATUS_TRANSITIONS: Record<TournamentStatus, readonly TournamentStatus[]> = {
  pending: ["running", "finished", "cancelled"],
  running: ["finished", "cancelled"],
  finished: [],
  cancelled: [],
};

export function statusAllows(rule: StatusRule, status: TournamentStatus): boolean {
  return rule.allowed.includes(status);
}

// Entradas que o torneio permite, sem olhar participante: Rebuy, add-on e bônus.
// O servidor (Ledger de Knockout e checks de participant-entries), as Ações rápidas
// e o painel Fichas em jogo leem estas mesmas condições.

import type { tournaments } from "@/db/schema";

type Tournament = typeof tournaments.$inferSelect;

export function allowsRebuy(tournament: Pick<Tournament, "rebuyAmount">): boolean {
  return tournament.rebuyAmount > 0;
}

// Limite de Rebuys por pessoa; null = ilimitado (limite 0 no torneio).
export function rebuyLimit(tournament: Pick<Tournament, "maxRebuys">): number | null {
  return tournament.maxRebuys > 0 ? tournament.maxRebuys : null;
}

export function allowsAddon(tournament: Pick<Tournament, "allowAddon">): boolean {
  return tournament.allowAddon;
}

export function allowsBonusChip(tournament: Pick<Tournament, "bonusChipAmount">): boolean {
  return tournament.bonusChipAmount > 0;
}

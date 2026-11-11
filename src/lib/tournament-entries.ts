// Entradas que o torneio permite (Rebuy, add-on e bônus) e quanto cada Participante
// pagou por elas. O servidor (Ledger de Knockout e checks de participant-entries),
// as Ações rápidas, a lista de participantes e o painel Fichas em jogo leem estas
// mesmas condições.

import type { participants, tournaments } from "@/db/schema";

type Tournament = typeof tournaments.$inferSelect;
type Participant = typeof participants.$inferSelect;

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

// Total pago pelo Participante: buy-in confirmado, Rebuys (o Rebuy duplo já conta 2
// no rebuyCount) e add-ons. O bônus não custa nada.
export function totalPaid(
  participant: Pick<Participant, "buyInPaid" | "rebuyCount" | "addonCount">,
  tournament: Pick<Tournament, "buyInAmount" | "rebuyAmount" | "addonAmount">
): number {
  return (
    (participant.buyInPaid ? tournament.buyInAmount : 0) +
    participant.rebuyCount * tournament.rebuyAmount +
    participant.addonCount * tournament.addonAmount
  );
}

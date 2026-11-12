// Entradas que o torneio permite (Rebuy, add-on e bônus) e quanto cada Participante
// pagou por elas. Servidor e telas leem daqui, em vez de repetir a condição.

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

// O Participante ainda pode fazer `count` Rebuys (1, ou 2 no Rebuy duplo): o torneio
// permite Rebuy e o total não passa do limite.
export function canRebuy(
  participant: Pick<Participant, "rebuyCount">,
  tournament: Pick<Tournament, "rebuyAmount" | "maxRebuys">,
  count: 1 | 2
): boolean {
  if (!allowsRebuy(tournament)) return false;
  const limit = rebuyLimit(tournament);
  return limit === null || participant.rebuyCount + count <= limit;
}

export function allowsAddon(tournament: Pick<Tournament, "allowAddon">): boolean {
  return tournament.allowAddon;
}

export function allowsBonusChip(tournament: Pick<Tournament, "bonusChipAmount">): boolean {
  return tournament.bonusChipAmount > 0;
}

// Buy-in confirmado, Em jogo ou não.
export function hasConfirmedBuyIn(participant: Pick<Participant, "buyInPaid">): boolean {
  return participant.buyInPaid;
}

// Total pago pelo Participante: buy-in confirmado, Rebuys (o Rebuy duplo já conta 2
// no rebuyCount) e add-ons. O bônus não custa nada.
export function totalPaid(
  participant: Pick<Participant, "buyInPaid" | "rebuyCount" | "addonCount">,
  tournament: Pick<Tournament, "buyInAmount" | "rebuyAmount" | "addonAmount">
): number {
  return (
    (hasConfirmedBuyIn(participant) ? tournament.buyInAmount : 0) +
    participant.rebuyCount * tournament.rebuyAmount +
    participant.addonCount * tournament.addonAmount
  );
}

// Total pago numa linha que traz, junta, a entrada do Participante e os valores do
// torneio (ex.: histórico da temporada do jogador).
export function entryTotalPaid(
  entry: Pick<Participant, "buyInPaid" | "rebuyCount" | "addonCount"> &
    Pick<Tournament, "buyInAmount" | "rebuyAmount" | "addonAmount">
): number {
  return totalPaid(entry, entry);
}

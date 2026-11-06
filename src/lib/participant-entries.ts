// Precondições das entradas de um participante fora do Ledger de Knockout:
// buy-in, add-on e bônus, e os Desfazer deles. A action roda cada uma duas
// vezes: na leitura de fora (resposta rápida ao admin) e na releitura dentro
// do lock do torneio, que é a que decide. O Status do torneio e o
// "participante nao encontrado" ficam com quem carrega as leituras.

import type { participants, tournaments } from "@/db/schema";

type Participant = typeof participants.$inferSelect;
type Tournament = typeof tournaments.$inferSelect;

export type Refusal = { error: string } | null;

// Regras de entrada do torneio: o que ele permite, sem olhar participante. As
// mesmas condições valem no servidor, nas Ações rápidas e no painel Fichas em jogo.
export function allowsRebuy(tournament: Pick<Tournament, "rebuyAmount">): boolean {
  return tournament.rebuyAmount > 0;
}

export function allowsAddon(tournament: Pick<Tournament, "allowAddon">): boolean {
  return tournament.allowAddon;
}

export function allowsBonusChip(tournament: Pick<Tournament, "bonusChipAmount">): boolean {
  return tournament.bonusChipAmount > 0;
}

export function checkConfirmBuyIn(participant: Pick<Participant, "buyInPaid">): Refusal {
  if (participant.buyInPaid) return { error: "Buy-in ja confirmado" };
  return null;
}

export function checkUndoBuyIn(
  participant: Pick<
    Participant,
    "buyInPaid" | "status" | "rebuyCount" | "addonCount" | "bonusChipUsed" | "bountiesCollected"
  >
): Refusal {
  if (!participant.buyInPaid) return { error: "Buy-in nao confirmado" };
  if (participant.status !== "playing") return { error: "Desfaca a eliminacao antes de remover o buy-in" };
  if (
    participant.rebuyCount > 0 ||
    participant.addonCount > 0 ||
    participant.bonusChipUsed ||
    participant.bountiesCollected > 0
  ) {
    return { error: "Desfaca rebuys, add-ons, bonus e bounties antes de remover o buy-in" };
  }
  return null;
}

export function checkAddAddon(
  participant: Pick<Participant, "buyInPaid">,
  tournament: Pick<Tournament, "allowAddon">
): Refusal {
  if (!participant.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };
  if (!allowsAddon(tournament)) return { error: "Torneio nao permite add-on" };
  return null;
}

export function checkUndoAddon(participant: Pick<Participant, "addonCount">): Refusal {
  if (participant.addonCount <= 0) return { error: "Nenhum add-on para desfazer" };
  return null;
}

export function checkAddBonusChip(
  participant: Pick<Participant, "status" | "bonusChipUsed">,
  tournament: Pick<Tournament, "bonusChipAmount">
): Refusal {
  if (participant.status !== "playing") return { error: "Participante nao esta em jogo" };
  if (participant.bonusChipUsed) return { error: "Bonus chip ja utilizado" };
  if (!allowsBonusChip(tournament)) return { error: "Torneio nao permite bonus chip" };
  return null;
}

export function checkUndoBonusChip(participant: Pick<Participant, "bonusChipUsed">): Refusal {
  if (!participant.bonusChipUsed) return { error: "Bonus chip nao foi utilizado" };
  return null;
}

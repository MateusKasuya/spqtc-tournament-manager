// Precondições das entradas de um participante fora do Ledger de Knockout:
// remover, buy-in, add-on e bônus, os Desfazer deles e quem pode receber
// Prêmio. A action roda as de um participante duas vezes: na leitura de fora
// (resposta rápida ao admin) e na releitura dentro do lock do torneio, que é a
// que decide. O Status do torneio e o "participante nao encontrado" ficam com
// quem carrega as leituras; "tem Prêmio pago" depende das transações e é
// consultado pela action dentro do lock.

import type { participants, tournaments } from "@/db/schema";
import { allowsAddon, allowsBonusChip } from "@/lib/tournament-entries";

type Participant = typeof participants.$inferSelect;
type Tournament = typeof tournaments.$inferSelect;

export type Refusal = { error: string } | null;

export function checkRemoveParticipant(participant: Pick<Participant, "status">): Refusal {
  if (participant.status !== "registered") {
    return { error: "Apenas jogadores com status 'registrado' podem ser removidos" };
  }
  return null;
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

// Distribuir prêmios: só recebe Prêmio quem está inscrito e tem buy-in
// confirmado (Em jogo ou eliminado). Um item fora disso recusa a distribuição
// inteira, em vez de ser descartado em silêncio.
export function checkPayoutRecipients(
  payouts: readonly { playerId: number }[],
  enrolled: readonly Pick<Participant, "playerId" | "buyInPaid">[]
): Refusal {
  const byPlayer = new Map(enrolled.map((p) => [p.playerId, p]));
  if (payouts.some((p) => !byPlayer.has(p.playerId))) return { error: "Jogador nao inscrito neste torneio" };
  if (payouts.some((p) => !byPlayer.get(p.playerId)?.buyInPaid)) {
    return { error: "So recebe Premio quem tem buy-in confirmado" };
  }
  return null;
}

import type { MesaParticipant } from "@/db/queries/mesa";

// Em jogo (CONTEXT.md) pelo status do Participante, nunca pela Posição final: uma
// distribuição de prêmios grava posição até em quem ainda está Em jogo. É a única
// contagem de Em jogo dos painéis.
export function isPlaying(participant: Pick<MesaParticipant, "status">): boolean {
  return participant.status === "playing";
}

export function countPlaying(participants: Pick<MesaParticipant, "status">[]): number {
  return participants.filter(isPlaying).length;
}

// Participantes com buy-in confirmado, Em jogo ou não: a única contagem "com
// buy-in" dos painéis (Jogadores, Fichas em jogo e Prize pool).
export function countWithBuyIn(participants: Pick<MesaParticipant, "buyInPaid">[]): number {
  return participants.filter((p) => p.buyInPaid).length;
}

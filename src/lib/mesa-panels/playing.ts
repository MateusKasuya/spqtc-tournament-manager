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

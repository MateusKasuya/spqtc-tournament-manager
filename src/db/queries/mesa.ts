import { getMesaTournament, getMesaLevels, getMesaPrizeStructure } from "@/db/queries/tournaments";
import { getMesaParticipants } from "@/db/queries/participants";
import { getPaidPrizesByParticipant, getTournamentFinancialSummary } from "@/db/queries/transactions";

// Parte ao vivo do snapshot da mesa: o que muda a cada ação da mesa (inclusive
// Distribuir prêmios) ou edição das estruturas de blinds e de prêmios. A página a carrega dentro do snapshot e a
// action `getMesaLiveData` a devolve sozinha.
export async function loadMesaLive(tournamentId: number) {
  const [blindLevels, participants, financialSummary, prizeStructure, paidPrizes] = await Promise.all([
    getMesaLevels(tournamentId),
    getMesaParticipants(tournamentId),
    getTournamentFinancialSummary(tournamentId),
    getMesaPrizeStructure(tournamentId),
    getPaidPrizesByParticipant(tournamentId),
  ]);
  return { blindLevels, participants, financialSummary, prizeStructure, paidPrizes };
}

export async function loadMesaSnapshot(tournamentId: number) {
  const tournament = await getMesaTournament(tournamentId);
  if (!tournament) return null;
  return { tournament, ...(await loadMesaLive(tournamentId)) };
}

export type MesaSnapshot = NonNullable<Awaited<ReturnType<typeof loadMesaSnapshot>>>;
export type MesaTournament = MesaSnapshot["tournament"];
export type MesaParticipant = MesaSnapshot["participants"][number];
export type MesaLevel = MesaSnapshot["blindLevels"][number];
export type MesaFinancialSummary = MesaSnapshot["financialSummary"];
export type MesaPrizePosition = MesaSnapshot["prizeStructure"][number];
export type MesaPaidPrize = MesaSnapshot["paidPrizes"][number];

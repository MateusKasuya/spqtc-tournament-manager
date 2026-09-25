import { getMesaTournament, getMesaLevels } from "@/db/queries/tournaments";
import { getMesaParticipants } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";

// Parte ao vivo do snapshot da mesa: o que muda a cada ação da mesa ou edição da
// estrutura de blinds. A página a carrega dentro do snapshot e a action
// `getMesaLiveData` a devolve sozinha.
export async function loadMesaLive(tournamentId: number) {
  const [blindLevels, participants, financialSummary] = await Promise.all([
    getMesaLevels(tournamentId),
    getMesaParticipants(tournamentId),
    getTournamentFinancialSummary(tournamentId),
  ]);
  return { blindLevels, participants, financialSummary };
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

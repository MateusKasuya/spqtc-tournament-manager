import { revalidatePath } from "next/cache";

// Atualiza todas as telas de um torneio: detalhe, edição e a mesa ao vivo.
export function revalidateTournament(tournamentId: number) {
  revalidatePath(`/torneios/${tournamentId}`, "layout");
}

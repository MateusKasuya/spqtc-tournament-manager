"use server";

import { createClient } from "@/lib/supabase/server";
import { getParticipants } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";

// Leitura leve usada pelo hook useMesaData para re-sincronizar a mesa ao vivo
// sem re-renderizar toda a árvore RSC (como faria router.refresh()).
// Reaproveita exatamente as mesmas queries e defaults da página da mesa
// (src/app/(dashboard)/torneios/[id]/mesa/page.tsx).
export async function getMesaLiveData(tournamentId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");

  const [participantsRaw, financialSummary] = await Promise.all([
    getParticipants(tournamentId),
    getTournamentFinancialSummary(tournamentId),
  ]);

  const participants = participantsRaw.map((p) => ({
    ...p,
    finishPosition: p.finishPosition ?? null,
    currentBounty: p.currentBounty ?? 0,
    bountiesCollected: p.bountiesCollected ?? 0,
  }));

  return { participants, financialSummary };
}

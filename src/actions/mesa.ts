"use server";

import { createClient } from "@/lib/supabase/server";
import { loadMesaLive } from "@/db/queries/mesa";

// Leitura leve usada pelo hook useMesaSnapshot para re-sincronizar a mesa ao vivo
// sem re-renderizar toda a árvore RSC (como faria router.refresh()).
// Mesmo caminho de carga da página da mesa (loadMesaSnapshot compõe loadMesaLive).
export async function getMesaLiveData(tournamentId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");

  return loadMesaLive(tournamentId);
}

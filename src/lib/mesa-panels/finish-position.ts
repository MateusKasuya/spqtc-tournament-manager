import type { MesaParticipant } from "@/db/queries/mesa";

// Ordem pela Posição final como está gravada (repetida, #71, não é corrigida), da
// menor para a maior; sem posição vai para o fim. O sort é estável: no empate fica
// a ordem de entrada, a da leitura da mesa (ordem de inscrição). As Eliminações do
// Jogadores e os Prêmios pagos do Prize pool ordenam por aqui.
export function compareFinishPosition(
  a: Pick<MesaParticipant, "finishPosition">,
  b: Pick<MesaParticipant, "finishPosition">
): number {
  return (a.finishPosition ?? Number.MAX_SAFE_INTEGER) - (b.finishPosition ?? Number.MAX_SAFE_INTEGER);
}

import type { MesaFinancialSummary } from "@/db/queries/mesa";

// Há Prêmios pagos quando o total de Prêmios pagos do resumo financeiro passa de
// zero. Nunca pelo valor de Prêmio guardado no participante, que fica velho numa
// redistribuição. É a condição única de "há Prêmios pagos" para todos os painéis;
// mora fora de `prize-pool.ts` para a fronteira do dinheiro importá-la sem ciclo.
export function hasPrizesPaid({ financialSummary }: { financialSummary: MesaFinancialSummary }): boolean {
  return financialSummary.prize > 0;
}

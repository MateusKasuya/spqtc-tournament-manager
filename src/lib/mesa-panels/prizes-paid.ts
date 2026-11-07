import { displayName } from "@/lib/display-name";
import type { MesaSnapshot } from "@/db/queries/mesa";
import { compareFinishPosition } from "./finish-position";

// Os Prêmios pagos da mesa e a condição única de "há Prêmios pagos" de todos os
// painéis (linha de dinheiro, estimados × pagos, face "1º R$ X"). Mora fora de
// `prize-pool.ts` para a fronteira do dinheiro importá-la sem ciclo.
//
// A única fonte é a lista por Participante, nunca o total do resumo financeiro nem
// o Prêmio guardado no participante: o resumo soma também o registro órfão de um
// Participante removido e vem de outra leitura, e o Prêmio guardado fica velho numa
// redistribuição. Assim a lista, o total e o Saldo nunca discordam.

export interface PaidPrizeEntry {
  participantId: number;
  name: string;
  // Como está gravada (Distribuir prêmios grava junto com o Prêmio); `null` depois
  // de um Desfazer que a zerou.
  finishPosition: number | null;
  amount: number;
}

export interface PrizesPaid {
  // Pela Posição final, quem está sem ela no fim.
  byPosition: PaidPrizeEntry[];
  total: number;
}

type PrizesPaidSource = Pick<MesaSnapshot, "participants" | "paidPrizesByParticipant">;

// `null` sem Prêmio pago a um Participante da mesa. Parte da ordem da leitura da
// mesa (ordem de inscrição), o desempate de `compareFinishPosition`.
export function derivePrizesPaid({ participants, paidPrizesByParticipant }: PrizesPaidSource): PrizesPaid | null {
  const amountByParticipant = new Map(paidPrizesByParticipant.map((p) => [p.participantId, p.amount]));
  const byPosition = participants
    .flatMap((p) => {
      const amount = amountByParticipant.get(p.id);
      if (amount === undefined || amount <= 0) return [];
      return [{ participantId: p.id, name: displayName(p), finishPosition: p.finishPosition, amount }];
    })
    .sort(compareFinishPosition);
  if (byPosition.length === 0) return null;
  return { byPosition, total: byPosition.reduce((sum, p) => sum + p.amount, 0) };
}

export function hasPrizesPaid(snapshot: PrizesPaidSource): boolean {
  return derivePrizesPaid(snapshot) !== null;
}

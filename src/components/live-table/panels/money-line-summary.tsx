import type { MoneyLine } from "@/lib/mesa-panels";

// Resumo da Fronteira do dinheiro, o mesmo no painel do Prize pool e no Jogadores:
// "Pagam N · M em jogo · faltam K" e o estado (Bolha em destaque, No dinheiro ou
// quantas Eliminações faltam). No dinheiro, faltam K vira 0.
export function MoneyLineSummary({ moneyLine }: { moneyLine: MoneyLine }) {
  const remaining = Math.max(moneyLine.remaining, 0);
  return (
    <div className="flex flex-col gap-2">
      {moneyLine.state === "bubble" && (
        <p className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950">
          Bolha: quem cair agora nao leva premio
        </p>
      )}
      {moneyLine.state === "inTheMoney" && (
        <p className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">No dinheiro</p>
      )}
      {moneyLine.state === "beforeMoney" && (
        <p className="text-sm font-medium">Faltam {remaining} Eliminacoes para o dinheiro</p>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        Pagam {moneyLine.paysThrough} · {moneyLine.playing} em jogo · faltam {remaining}
      </p>
    </div>
  );
}

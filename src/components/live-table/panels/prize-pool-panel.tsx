import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type {
  MoneyLine,
  PrizePoolPanel as PrizePoolPanelModel,
  PrizeStructureSection,
} from "@/lib/mesa-panels";

// Painel Prize pool: a conta do número do card, de Arrecadado a Prize pool e, quando
// há Prêmios pagos, até o Saldo; abaixo, a Estrutura de prêmios com o Prêmio
// estimado e a fronteira do dinheiro. Recebe o modelo da derivação e só desenha.
export function PrizePoolPanel({ panel }: { panel: PrizePoolPanelModel }) {
  return (
    <div className="flex flex-col gap-6">
      <Account panel={panel} />
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Estrutura de premios</h3>
        {panel.paidPositionsAboveBuyIns && (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
            A Estrutura paga {panel.paidPositionsAboveBuyIns.paidPositions} posicoes e so ha{" "}
            {panel.paidPositionsAboveBuyIns.buyIns} participantes com buy-in. A mesa nao muda a Estrutura.
          </p>
        )}
        {panel.moneyLine && <MoneyLineSummary moneyLine={panel.moneyLine} />}
        {panel.nextOut && (
          <p className="text-sm">
            O proximo a cair termina em {panel.nextOut.position}º e leva{" "}
            <span className="font-semibold">{formatCurrency(panel.nextOut.prize)}</span>
          </p>
        )}
        {panel.structure ? (
          <StructureTable structure={panel.structure} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem Estrutura de premios: nao ha Premios estimados nem linha de dinheiro.
          </p>
        )}
      </section>
    </div>
  );
}

function Account({ panel }: { panel: PrizePoolPanelModel }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <tbody>
        <Row label="Buy-ins" amount={panel.buyIns} />
        <Row label="Rebuys" amount={panel.rebuys} />
        <Row label="Add-ons" amount={panel.addons} />
        <Row label="Arrecadado" amount={panel.collected} total />
        <Row label="Fundo de ranking" amount={panel.rankingFund} deduction />
        {panel.bountyAllocated !== null && <Row label="Bounty armado" amount={panel.bountyAllocated} deduction />}
        <Row label="Prize pool" amount={panel.prizePool} total />
        {panel.prizesPaid && (
          <>
            <Row label="Premios pagos" amount={panel.prizesPaid.total} deduction />
            <Row label="Saldo" amount={panel.prizesPaid.balance} total />
          </>
        )}
      </tbody>
    </table>
  );
}

// Resumo "Pagam N · M em jogo · faltam K" e o estado: Bolha em destaque, No
// dinheiro ou quantas Eliminações faltam. No dinheiro, faltam K vira 0.
function MoneyLineSummary({ moneyLine }: { moneyLine: MoneyLine }) {
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
        Pagam {moneyLine.paidPositions} · {moneyLine.playing} em jogo · faltam {remaining}
      </p>
    </div>
  );
}

// Percentual e Prêmio estimado por posição; a linha até onde paga fica abaixo da
// última posição com percentual maior que zero.
function StructureTable({ structure }: { structure: PrizeStructureSection }) {
  return (
    <div className="flex flex-col gap-1">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th scope="col" className="py-2 pr-3 text-left font-medium">Posicao</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">%</th>
            <th scope="col" className="py-2 text-right font-medium">Premio estimado</th>
          </tr>
        </thead>
        <tbody>
          {structure.positions.map((p) => {
            const paysThrough = p.position === structure.paysThroughPosition;
            return (
              <tr
                key={p.position}
                className={cn(
                  paysThrough ? "border-b-2 border-dashed border-emerald-600" : "border-b",
                  p.position > structure.paysThroughPosition && "text-muted-foreground"
                )}
              >
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {p.position}º
                  {paysThrough && <span className="ml-2 text-xs font-normal text-emerald-600">paga ate aqui</span>}
                </th>
                <td className="py-2 pr-3 text-right">{p.percentage}%</td>
                <td className="py-2 text-right whitespace-nowrap">{formatCurrency(p.estimatedPrize)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">estimado com o Prize pool atual</p>
    </div>
  );
}

// `deduction` sai da conta: sinal de menos e tom apagado. `total` fecha uma etapa.
// Um total negativo (Saldo, #73) fica em vermelho.
function Row({ label, amount, deduction = false, total = false }: {
  label: string;
  amount: number;
  deduction?: boolean;
  total?: boolean;
}) {
  return (
    <tr className={cn("border-b", deduction && "text-muted-foreground")}>
      <th scope="row" className={cn("py-2 pr-3 text-left", total ? "font-semibold" : "font-medium")}>
        {label}
      </th>
      <td
        className={cn(
          "py-2 text-right whitespace-nowrap",
          total && "font-semibold",
          total && amount < 0 && "text-destructive"
        )}
      >
        {deduction ? `− ${formatCurrency(amount)}` : formatCurrency(amount)}
      </td>
    </tr>
  );
}

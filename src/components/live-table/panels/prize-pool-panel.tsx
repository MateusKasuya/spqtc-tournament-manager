import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PrizePoolPanel as PrizePoolPanelModel } from "@/lib/mesa-panels";

// Painel Prize pool: a conta do número do card, de Arrecadado a Prize pool e, quando
// há Prêmios pagos, até o Saldo. Recebe o modelo da derivação e só desenha.
export function PrizePoolPanel({ panel }: { panel: PrizePoolPanelModel }) {
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

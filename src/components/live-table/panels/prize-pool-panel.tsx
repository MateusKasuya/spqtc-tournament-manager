import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PrizePoolPanel as PrizePoolPanelModel } from "@/lib/mesa-panels";

// Painel Prize pool: a conta do número do card, de Arrecadado a Prize pool e, quando
// há Prêmios pagos, até o Saldo. Recebe o modelo da derivação e só desenha.
export function PrizePoolPanel({ panel }: { panel: PrizePoolPanelModel }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <tbody>
        <Row label="Buy-ins" value={formatCurrency(panel.buyIns)} />
        <Row label="Rebuys" value={formatCurrency(panel.rebuys)} />
        <Row label="Add-ons" value={formatCurrency(panel.addons)} />
        <Row label="Arrecadado" value={formatCurrency(panel.collected)} strong />
        <Row label="Fundo de ranking" value={`− ${formatCurrency(panel.rankingFund)}`} muted />
        {panel.bountyAllocated !== null && (
          <Row label="Bounty armado" value={`− ${formatCurrency(panel.bountyAllocated)}`} muted />
        )}
        <Row label="Prize pool" value={formatCurrency(panel.prizePool)} strong />
        {panel.payout && (
          <>
            <Row label="Premios pagos" value={`− ${formatCurrency(panel.payout.prizesPaid)}`} muted />
            <Row
              label="Saldo"
              value={formatCurrency(panel.payout.saldo)}
              strong
              valueClassName={panel.payout.saldo < 0 ? "text-destructive" : undefined}
            />
          </>
        )}
      </tbody>
    </table>
  );
}

function Row({
  label,
  value,
  strong = false,
  muted = false,
  valueClassName,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  valueClassName?: string;
}) {
  return (
    <tr className={cn("border-b", strong && "font-semibold", muted && "text-muted-foreground")}>
      <th scope="row" className={cn("py-2 pr-3 text-left", strong ? "font-semibold" : "font-medium")}>
        {label}
      </th>
      <td className={cn("py-2 text-right whitespace-nowrap", valueClassName)}>{value}</td>
    </tr>
  );
}

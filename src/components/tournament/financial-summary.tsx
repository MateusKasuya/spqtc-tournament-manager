import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

interface FinancialSummaryProps {
  summary: {
    buy_in: number;
    rebuy: number;
    addon: number;
    prize: number;
    bounty_earned?: number;
  };
  prizePoolOverride: number | null;
  rankingFund: number;
  tournamentType?: string;
  totalBountyAllocated?: number;
}

export function FinancialSummary({ summary, prizePoolOverride, rankingFund, tournamentType, totalBountyAllocated }: FinancialSummaryProps) {
  const isBounty = tournamentType === "bounty_builder";
  const rawPot = summary.buy_in + summary.rebuy + summary.addon;
  const rawNet = rawPot - rankingFund;
  const prizePool = prizePoolOverride ?? (isBounty && totalBountyAllocated != null
    ? rawNet - totalBountyAllocated
    : rawNet);
  const bountiesPaid = summary.bounty_earned ?? 0;
  const balance = prizePool - summary.prize;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Financeiro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Buy-ins</span>
          <span>{formatCurrency(summary.buy_in)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rebuys</span>
          <span>{formatCurrency(summary.rebuy)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Add-ons</span>
          <span>{formatCurrency(summary.addon)}</span>
        </div>
        {rankingFund > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Fundo de ranking</span>
            <span>- {formatCurrency(rankingFund)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-1 mt-1">
          <span>
            Prize pool
            {prizePoolOverride !== null && (
              <span className="text-xs font-normal text-muted-foreground ml-1">(override)</span>
            )}
          </span>
          <span>{formatCurrency(prizePool)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Premios pagos</span>
          <span>{formatCurrency(summary.prize)}</span>
        </div>
        {isBounty && bountiesPaid > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bounties pagos</span>
            <span>{formatCurrency(bountiesPaid)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-1 mt-1">
          <span>Saldo</span>
          <span className={balance < 0 ? "text-destructive" : ""}>{formatCurrency(balance)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

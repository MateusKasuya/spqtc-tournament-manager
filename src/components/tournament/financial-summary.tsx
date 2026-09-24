import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { PrizePool } from "@/lib/prize-pool";

interface FinancialSummaryProps {
  summary: {
    buy_in: number;
    rebuy: number;
    addon: number;
    prize: number;
    bounty_earned?: number;
  };
  pool: PrizePool;
  balance: number;
  isBounty: boolean;
}

export function FinancialSummary({ summary, pool, balance, isBounty }: FinancialSummaryProps) {
  const bountiesPaid = summary.bounty_earned ?? 0;

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
        <div className="flex justify-between border-t pt-1 mt-1">
          <span className="text-muted-foreground">Arrecadado</span>
          <span>{formatCurrency(pool.collected)}</span>
        </div>
        {pool.rankingFund > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Fundo de ranking</span>
            <span>- {formatCurrency(pool.rankingFund)}</span>
          </div>
        )}
        {pool.bountyAllocated > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Bounty armado</span>
            <span>- {formatCurrency(pool.bountyAllocated)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-1 mt-1">
          <span>Prize pool</span>
          <span>{formatCurrency(pool.prizePool)}</span>
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

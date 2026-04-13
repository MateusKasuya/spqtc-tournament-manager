import { formatChips, formatCurrency } from "@/lib/format";
import { Users, BarChart2, Layers, Trophy } from "lucide-react";

interface Participant {
  status: string;
  buyInPaid: boolean;
  rebuyCount: number;
  addonUsed: boolean;
}

interface Tournament {
  initialChips: number;
  rebuyChips: number;
  addonChips: number;
  prizePoolOverride: number | null;
  rankingFeeAmount: number;
}

interface FinancialSummary {
  buy_in: number;
  rebuy: number;
  addon: number;
  prize: number;
}

interface TournamentStatsProps {
  participants: Participant[];
  tournament: Tournament;
  financialSummary: FinancialSummary;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function TournamentStats({ participants, tournament, financialSummary }: TournamentStatsProps) {
  const playingCount = participants.filter((p) => p.status === "playing").length;
  const paidCount = participants.filter((p) => p.buyInPaid).length;
  const totalRebuys = participants.reduce((sum, p) => sum + p.rebuyCount, 0);
  const totalAddons = participants.filter((p) => p.addonUsed).length;

  const totalChips =
    paidCount * tournament.initialChips +
    totalRebuys * tournament.rebuyChips +
    totalAddons * tournament.addonChips;

  const avgStack = playingCount > 0 ? Math.round(totalChips / playingCount) : 0;

  const rankingFund = paidCount * tournament.rankingFeeAmount;
  const prizePool =
    tournament.prizePoolOverride ??
    (financialSummary.buy_in + financialSummary.rebuy + financialSummary.addon - rankingFund);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard
        icon={<Users className="h-3.5 w-3.5" />}
        label="Jogadores"
        value={`${playingCount}`}
        sub={`de ${paidCount} pagos`}
      />
      <StatCard
        icon={<BarChart2 className="h-3.5 w-3.5" />}
        label="Stack medio"
        value={formatChips(avgStack)}
      />
      <StatCard
        icon={<Layers className="h-3.5 w-3.5" />}
        label="Fichas em jogo"
        value={formatChips(totalChips)}
      />
      <StatCard
        icon={<Trophy className="h-3.5 w-3.5" />}
        label="Prize pool"
        value={formatCurrency(prizePool)}
        sub={tournament.prizePoolOverride ? "override" : undefined}
      />
    </div>
  );
}

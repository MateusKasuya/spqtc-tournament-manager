import { formatChips, formatCurrency } from "@/lib/format";
import { computePrizePool } from "@/lib/prize-pool";
import type { MesaFinancialSummary, MesaParticipant, MesaTournament } from "@/db/queries/mesa";
import { Users, BarChart2, Layers, Trophy, Target } from "lucide-react";

interface TournamentStatsProps {
  participants: Pick<
    MesaParticipant,
    "status" | "buyInPaid" | "rebuyCount" | "addonCount" | "bonusChipUsed" | "currentBounty" | "bountiesCollected"
  >[];
  tournament: Pick<
    MesaTournament,
    "initialChips" | "rebuyChips" | "addonChips" | "bonusChipAmount" | "rankingFeeAmount" | "tournamentType"
  >;
  financialSummary: Pick<MesaFinancialSummary, "buy_in" | "rebuy" | "addon">;
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
  const totalAddons = participants.reduce((sum, p) => sum + p.addonCount, 0);
  const totalBonusChips = participants.filter((p) => p.bonusChipUsed).length;

  const totalChips =
    paidCount * tournament.initialChips +
    totalRebuys * tournament.rebuyChips +
    totalAddons * tournament.addonChips +
    totalBonusChips * tournament.bonusChipAmount;

  const avgStack = playingCount > 0 ? Math.round(totalChips / playingCount) : 0;

  const isBounty = tournament.tournamentType === "bounty_builder";
  const { prizePool } = computePrizePool({ rules: tournament, collected: financialSummary, participants });

  const activeBountyPool = isBounty
    ? participants.reduce((sum, p) => sum + p.currentBounty, 0)
    : 0;

  const cols = isBounty ? "sm:grid-cols-5" : "sm:grid-cols-4";

  return (
    <div className={`grid grid-cols-2 gap-2 ${cols}`}>
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
      />
      {isBounty && (
        <StatCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="Bounty pool"
          value={formatCurrency(activeBountyPool)}
          sub="em jogo"
        />
      )}
    </div>
  );
}

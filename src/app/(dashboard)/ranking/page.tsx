import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getSeasonRanking, getSeasonPointsByTournament, getSeasonRankingFund } from "@/db/queries/ranking";
import { getActiveSeason, getSeasons } from "@/db/queries/seasons";
import { getTournaments } from "@/db/queries/tournaments";
import { RankingTable } from "@/components/ranking/ranking-table";
import { SeasonSelector } from "@/components/ranking/season-selector";
import { formatCurrency } from "@/lib/format";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const [seasons, activeSeason] = await Promise.all([getSeasons(), getActiveSeason()]);

  const selectedSeasonId = params.season
    ? Number(params.season)
    : activeSeason?.id;

  if (!selectedSeasonId || seasons.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Ranking</h1>
        <p className="text-muted-foreground text-sm">
          Nenhuma temporada encontrada. Crie uma temporada primeiro.
        </p>
      </div>
    );
  }

  const [ranking, pointsByTournament, allTournaments, rankingFund] = await Promise.all([
    getSeasonRanking(selectedSeasonId),
    getSeasonPointsByTournament(selectedSeasonId),
    getTournaments(),
    getSeasonRankingFund(selectedSeasonId),
  ]);

  const seasonTournaments = allTournaments
    .filter((t) => t.seasonId === selectedSeasonId && t.status === "finished")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ranking</h1>
          {selectedSeason && (
            <p className="text-sm text-muted-foreground mt-0.5">{selectedSeason.name}</p>
          )}
        </div>
        {seasons.length > 1 && (
          <SeasonSelector seasons={seasons} selectedSeasonId={selectedSeasonId} />
        )}
      </div>

      {rankingFund > 0 && (
        <div className="rounded-lg border px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Fundo de ranking acumulado</span>
          <span className="font-semibold">{formatCurrency(rankingFund)}</span>
        </div>
      )}

      <RankingTable
        ranking={ranking}
        pointsByTournament={pointsByTournament}
        seasonTournaments={seasonTournaments}
      />
    </div>
  );
}

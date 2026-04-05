import { redirect, notFound } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getPlayerById } from "@/db/queries/players";
import { getPlayerStats, getPlayerSeasonHistory } from "@/db/queries/ranking";
import { getActiveSeason } from "@/db/queries/seasons";
import { PlayerProfile } from "@/components/player/player-profile";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const playerId = Number(id);
  if (isNaN(playerId)) notFound();

  const [player, activeSeason] = await Promise.all([
    getPlayerById(playerId),
    getActiveSeason(),
  ]);

  if (!player) notFound();

  const [stats, seasonHistory] = await Promise.all([
    getPlayerStats(playerId),
    activeSeason ? getPlayerSeasonHistory(playerId, activeSeason.id) : Promise.resolve([]),
  ]);

  return (
    <PlayerProfile
      player={player}
      stats={stats}
      seasonHistory={seasonHistory}
      seasonName={activeSeason?.name ?? null}
    />
  );
}

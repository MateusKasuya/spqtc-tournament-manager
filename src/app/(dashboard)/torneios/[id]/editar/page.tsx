import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getTournamentById } from "@/db/queries/tournaments";
import { getSeasons } from "@/db/queries/seasons";
import { TournamentForm } from "@/components/tournament/tournament-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarTorneioPage({ params }: PageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (isNaN(tournamentId)) notFound();

  const [profile, tournament, seasons] = await Promise.all([
    getProfile(),
    getTournamentById(tournamentId),
    getSeasons(),
  ]);

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect(`/torneios/${tournamentId}`);
  if (!tournament) notFound();

  if (["finished", "cancelled"].includes(tournament.status)) {
    redirect(`/torneios/${tournamentId}`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/torneios/${tournamentId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Editar Torneio</h1>
      </div>

      <TournamentForm
        seasons={seasons}
        initialData={{
          id: tournament.id,
          name: tournament.name,
          date: new Date(tournament.date),
          seasonId: tournament.seasonId,
          buyInAmount: tournament.buyInAmount,
          rebuyAmount: tournament.rebuyAmount,
          addonAmount: tournament.addonAmount,
          initialChips: tournament.initialChips,
          rebuyChips: tournament.rebuyChips,
          addonChips: tournament.addonChips,
          bonusChipAmount: tournament.bonusChipAmount,
          maxRebuys: tournament.maxRebuys,
          allowAddon: tournament.allowAddon,
          rankingFeeAmount: tournament.rankingFeeAmount,
        }}
      />
    </div>
  );
}

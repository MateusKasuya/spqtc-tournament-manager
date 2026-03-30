import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentById, getBlindStructure } from "@/db/queries/tournaments";
import { getParticipants } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { MesaAoVivo } from "@/components/live-table/mesa-ao-vivo";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MesaPage({ params }: PageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (isNaN(tournamentId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) notFound();
  if (tournament.status !== "running") redirect(`/torneios/${tournamentId}`);

  const [blindLevels, participants, financialSummary] = await Promise.all([
    getBlindStructure(tournamentId),
    getParticipants(tournamentId),
    getTournamentFinancialSummary(tournamentId),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <MesaAoVivo
      tournament={{
        ...tournament,
        timerStartedAt: tournament.timerStartedAt?.toISOString() ?? null,
      }}
      blindLevels={blindLevels}
      participants={participants.map((p) => ({
        ...p,
        finishPosition: p.finishPosition ?? null,
      }))}
      financialSummary={financialSummary}
      isAdmin={isAdmin}
    />
  );
}

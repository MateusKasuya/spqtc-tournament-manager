import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { loadMesaSnapshot } from "@/db/queries/mesa";
import { MesaAoVivo } from "@/components/live-table/mesa-ao-vivo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MesaPage({ params }: PageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (isNaN(tournamentId)) notFound();

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const snapshot = await loadMesaSnapshot(tournamentId);
  if (!snapshot) notFound();
  if (snapshot.tournament.status !== "running") redirect(`/torneios/${tournamentId}`);

  // key: trocar de torneio remonta a mesa, sem herdar busca em voo do anterior.
  return <MesaAoVivo key={tournamentId} snapshot={snapshot} isAdmin={profile.role === "admin"} />;
}

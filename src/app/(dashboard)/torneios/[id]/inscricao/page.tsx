import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getTournamentById } from "@/db/queries/tournaments";
import { getParticipantByUserAndTournament } from "@/db/queries/participants";
import { getSeasonById } from "@/db/queries/seasons";
import { SelfRegisterButton } from "@/components/tournament/self-register-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/tournament/status-badge";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InscricaoPage({ params }: PageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (isNaN(tournamentId)) notFound();

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) notFound();

  const season = tournament.seasonId ? await getSeasonById(tournament.seasonId) : null;
  const existing = await getParticipantByUserAndTournament(profile.id, tournamentId);

  const isOpen = ["pending", "running"].includes(tournament.status);
  const alreadyRegistered = !!existing;

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/torneios/${tournamentId}`}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{tournament.name}</h1>
          {season && <p className="text-sm text-muted-foreground">{season.name}</p>}
        </div>
        <StatusBadge status={tournament.status as "pending" | "running" | "finished" | "cancelled"} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhes do torneio</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-muted-foreground">Data</span>
          <span>
            {format(new Date(tournament.date), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </span>
          <span className="text-muted-foreground">Buy-in</span>
          <span className="font-semibold">{formatCurrency(tournament.buyInAmount)}</span>
          {tournament.rebuyAmount > 0 && (
            <>
              <span className="text-muted-foreground">Rebuy</span>
              <span>{formatCurrency(tournament.rebuyAmount)}</span>
            </>
          )}
          {tournament.allowAddon && (
            <>
              <span className="text-muted-foreground">Add-on</span>
              <span>{formatCurrency(tournament.addonAmount)}</span>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border p-4 space-y-3">
        {alreadyRegistered ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <span>Voce ja esta inscrito neste torneio.</span>
          </div>
        ) : !isOpen ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-5 w-5 shrink-0" />
            <span>Inscricoes encerradas para este torneio.</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ao se inscrever, o admin confirmara seu buy-in no dia do torneio.
            </p>
            <SelfRegisterButton tournamentId={tournamentId} />
          </>
        )}
      </div>
    </div>
  );
}

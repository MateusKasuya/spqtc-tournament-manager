import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getTournaments } from "@/db/queries/tournaments";
import { getActiveSeason } from "@/db/queries/seasons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { StatusBadge } from "@/components/tournament/status-badge";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Trophy } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const [activeSeason, allTournaments] = await Promise.all([
    getActiveSeason(),
    getTournaments(),
  ]);

  const isAdmin = profile?.role === "admin";

  const upcomingTournament = allTournaments.find((t) => t.status === "pending");
  const lastFinished = allTournaments.find((t) => t.status === "finished");
  const runningTournament = allTournaments.find((t) => t.status === "running");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ola, {profile?.name ?? "Jogador"}!</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {profile?.role === "admin" ? "Administrador" : "Jogador"}
        </p>
      </div>

      {runningTournament && (
        <Link href={`/torneios/${runningTournament.id}`}>
          <Card className="border-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">
                Torneio em andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{runningTournament.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(runningTournament.date), "d 'de' MMMM", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Temporada atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSeason ? (
              <>
                <p className="font-semibold">{activeSeason.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Desde {format(new Date(activeSeason.startDate), "d MMM yyyy", { locale: ptBR })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma temporada ativa</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Proximo torneio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTournament ? (
              <Link href={`/torneios/${upcomingTournament.id}`} className="block hover:underline">
                <p className="font-semibold">{upcomingTournament.name}</p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(upcomingTournament.date), "d MMM yyyy", { locale: ptBR })}
                </p>
                <p className="text-sm text-muted-foreground">
                  Buy-in: {formatCurrency(upcomingTournament.buyInAmount)}
                </p>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum torneio agendado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ultimo torneio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastFinished ? (
              <Link href={`/torneios/${lastFinished.id}`} className="block hover:underline">
                <p className="font-semibold">{lastFinished.name}</p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(lastFinished.date), "d MMM yyyy", { locale: ptBR })}
                </p>
                <StatusBadge status="finished" />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum torneio finalizado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <div className="flex gap-3">
          <Link href="/torneios/novo" className={buttonVariants()}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Torneio
          </Link>
          <Link href="/torneios" className={buttonVariants({ variant: "outline" })}>
            <Trophy className="h-4 w-4 mr-2" />
            Ver todos
          </Link>
        </div>
      )}
    </div>
  );
}

import { getProfile } from "@/lib/get-profile";
import { getTournaments } from "@/db/queries/tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { buttonVariants } from "@/components/ui/button-variants";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";

export default async function TorneiosPage() {
  const [profile, allTournaments] = await Promise.all([
    getProfile(),
    getTournaments(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Torneios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allTournaments.length} torneio{allTournaments.length !== 1 ? "s" : ""} no total
          </p>
        </div>
        {isAdmin && (
          <Link href="/torneios/novo" className={buttonVariants()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Torneio
          </Link>
        )}
      </div>

      {allTournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Nenhum torneio encontrado</p>
          {isAdmin && (
            <Link href="/torneios/novo" className={buttonVariants({ variant: "outline" }) + " mt-4"}>
              Criar primeiro torneio
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={{
                ...tournament,
                date: new Date(tournament.date),
                status: tournament.status as "pending" | "running" | "finished" | "cancelled",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

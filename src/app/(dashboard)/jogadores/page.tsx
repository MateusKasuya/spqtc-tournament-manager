import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getAllPlayers } from "@/db/queries/players";
import { CreatePlayerDialog } from "@/components/player/create-player-dialog";
import { EditPlayerDialog } from "@/components/player/edit-player-dialog";
import { DeletePlayerButton } from "@/components/player/delete-player-button";
import Link from "next/link";

export default async function JogadoresPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const playersList = await getAllPlayers();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jogadores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {playersList.length} jogador{playersList.length !== 1 ? "es" : ""} cadastrado{playersList.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreatePlayerDialog />
      </div>

      {playersList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhum jogador cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em &quot;Novo Jogador&quot; para adicionar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {playersList.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <Link
                href={`/jogadores/${player.id}`}
                className="flex-1 min-w-0 hover:opacity-70 transition-opacity"
              >
                <p className="text-sm font-medium">{player.name}</p>
                {player.nickname && (
                  <p className="text-xs text-muted-foreground">{player.nickname}</p>
                )}
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <EditPlayerDialog player={player} />
                <DeletePlayerButton playerId={player.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

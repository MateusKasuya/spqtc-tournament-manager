import type { CardFace, MesaPanelId, MesaPanelsView } from "@/lib/mesa-panels";
import { Users, BarChart2, Layers, Trophy, Target } from "lucide-react";

interface TournamentStatsProps {
  view: MesaPanelsView;
  onOpenPanel: (panel: MesaPanelId) => void;
}

interface StatCardProps {
  icon: React.ReactNode;
  face: CardFace;
  // Presente quando o card tem painel: o card vira botão que abre a gaveta.
  onOpen?: () => void;
}

function StatCard({ icon, face, onOpen }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{face.label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{face.value}</p>
      {face.supportLines.map((line, i) => (
        <p key={i} className="text-sm text-muted-foreground">{line}</p>
      ))}
    </>
  );

  if (!onOpen) {
    return <div className="flex flex-col gap-1 rounded-lg border p-3">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${face.label}: ${face.value}. Ver detalhes`}
      className="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  );
}

export function TournamentStats({ view, onOpenPanel }: TournamentStatsProps) {
  const { players, averageStack, chipsInPlay, prizePool, bounty } = view;
  const opener = (panel: MesaPanelId, model: unknown) => (model === null ? undefined : () => onOpenPanel(panel));
  const cols = bounty ? "sm:grid-cols-5" : "sm:grid-cols-4";

  return (
    <div className={`grid grid-cols-2 gap-2 ${cols}`}>
      <StatCard
        icon={<Users className="h-3.5 w-3.5" />}
        face={players.card}
        onOpen={opener("players", players.panel)}
      />
      <StatCard
        icon={<BarChart2 className="h-3.5 w-3.5" />}
        face={averageStack.card}
        onOpen={opener("averageStack", averageStack.panel)}
      />
      <StatCard
        icon={<Layers className="h-3.5 w-3.5" />}
        face={chipsInPlay.card}
        onOpen={opener("chipsInPlay", chipsInPlay.panel)}
      />
      <StatCard
        icon={<Trophy className="h-3.5 w-3.5" />}
        face={prizePool.card}
        onOpen={opener("prizePool", prizePool.panel)}
      />
      {bounty && (
        <StatCard
          icon={<Target className="h-3.5 w-3.5" />}
          face={bounty.card}
          onOpen={opener("bounty", bounty.panel)}
        />
      )}
    </div>
  );
}

import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type {
  PlayersCounts,
  PlayersPanel as PlayersPanelModel,
  PlayersPlayingEntry,
} from "@/lib/mesa-panels";

// Painel Jogadores: as contagens do card, o campeão em destaque, quem está Em jogo,
// as Eliminações com a Posição final e quem está Aguardando buy-in. Recebe o modelo
// da derivação e só desenha.
export function PlayersPanel({ panel }: { panel: PlayersPanelModel }) {
  return (
    <div className="flex flex-col gap-6">
      <Header counts={panel.counts} />
      {panel.champion && (
        <p className="flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950">
          <Trophy className="h-4 w-4" aria-hidden />
          Campeao: {panel.champion.name}
        </p>
      )}
      <Section title="Em jogo" empty="Ninguem em jogo">
        {panel.playing.map((p) => (
          <PlayingRow key={p.id} entry={p} />
        ))}
      </Section>
      {panel.eliminations.length > 0 && (
        <Section title="Eliminacoes">
          {panel.eliminations.map((p) => (
            <li key={p.id} className="flex items-baseline gap-3 py-2 text-sm">
              <span className="w-8 shrink-0 text-right font-medium tabular-nums text-muted-foreground">
                {p.finishPosition !== null && `${p.finishPosition}º`}
              </span>
              <span className="truncate">{p.name}</span>
            </li>
          ))}
        </Section>
      )}
      {panel.awaitingBuyIn.length > 0 && (
        <Section title="Aguardando buy-in">
          {panel.awaitingBuyIn.map((p) => (
            <li key={p.id} className="py-2 text-sm text-muted-foreground">
              {p.name}
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

function Header({ counts }: { counts: PlayersCounts }) {
  return (
    <p className="text-sm font-medium tabular-nums">
      {counts.playing} em jogo · {counts.buyIn} com buy-in · {counts.eliminated}{" "}
      {counts.eliminated === 1 ? "Eliminacao" : "Eliminacoes"}
    </p>
  );
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode[] }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children.length > 0 ? (
        <ul className="divide-y">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function PlayingRow({ entry }: { entry: PlayersPlayingEntry }) {
  const marks = [
    entry.rebuys > 0 && (entry.rebuys === 1 ? "Rebuy" : `${entry.rebuys} Rebuys`),
    entry.addons > 0 && (entry.addons === 1 ? "Add-on" : `${entry.addons} Add-ons`),
    entry.bonus && "Bonus",
  ].filter((mark): mark is string => mark !== false);
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <span className="truncate font-medium">{entry.name}</span>
      {marks.map((mark) => (
        <Badge key={mark} variant="secondary">
          {mark}
        </Badge>
      ))}
      {entry.bounty !== null && (
        <span className="ml-auto whitespace-nowrap tabular-nums text-muted-foreground">
          {formatCurrency(entry.bounty)}
        </span>
      )}
    </li>
  );
}

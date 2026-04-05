"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminatePlayer, addRebuy, addAddon, undoElimination, confirmBuyIn } from "@/actions/participants";
import { Skull, RefreshCw, Plus, RotateCcw, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface Participant {
  id: number;
  name: string;
  nickname: string | null;
  status: string;
  finishPosition: number | null;
  buyInPaid: boolean;
  rebuyCount: number;
  addonUsed: boolean;
}

interface Tournament {
  rebuyAmount: number;
  addonAmount: number;
  allowAddon: boolean;
  buyInAmount: number;
}

interface QuickActionsProps {
  participants: Participant[];
  tournament: Tournament;
}

function displayName(p: { name: string; nickname: string | null }) {
  return p.nickname ? `${p.name} (${p.nickname})` : p.name;
}

function ParticipantRow({
  participant,
  tournament,
}: {
  participant: Participant;
  tournament: Tournament;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ error?: string } | { success: boolean } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const isPlaying = participant.status === "playing";
  const isEliminated = participant.status === "eliminated";
  const isFinished = participant.status === "finished";

  const totalPaid =
    (participant.buyInPaid ? tournament.buyInAmount : 0) +
    participant.rebuyCount * tournament.rebuyAmount +
    (participant.addonUsed ? tournament.addonAmount : 0);

  return (
    <tr className={`border-b last:border-0 ${isEliminated ? "opacity-50" : ""}`}>
      {/* Posicao / Status */}
      <td className="py-2 pr-3 text-sm font-medium whitespace-nowrap">
        {isFinished
          ? <span>🏆 1º</span>
          : isEliminated && participant.finishPosition
          ? `${participant.finishPosition}º`
          : isPlaying
          ? <Badge variant="default" className="text-xs">Jogando</Badge>
          : "—"}
      </td>

      {/* Nome */}
      <td className="py-2 pr-3 text-sm max-w-[140px]">
        <span className="truncate block">{displayName(participant)}</span>
      </td>

      {/* Rebuys */}
      <td className="py-2 pr-3 text-sm text-center text-muted-foreground">
        {participant.rebuyCount > 0 ? participant.rebuyCount : "—"}
      </td>

      {/* Add-on */}
      <td className="py-2 pr-3 text-sm text-center text-muted-foreground">
        {participant.addonUsed ? "Sim" : "—"}
      </td>

      {/* Total investido */}
      <td className="py-2 pr-3 text-sm text-right text-muted-foreground whitespace-nowrap">
        {formatCurrency(totalPaid)}
      </td>

      {/* Acoes */}
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {isPlaying && (
            <>
              {tournament.rebuyAmount > 0 && (
                <button
                  type="button"
                  onClick={() => run(() => addRebuy(participant.id))}
                  disabled={isPending}
                  title="Rebuy"
                  className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="text-[10px] leading-none font-medium">Rebuy</span>
                </button>
              )}
              {tournament.allowAddon && !participant.addonUsed && (
                <button
                  type="button"
                  onClick={() => run(() => addAddon(participant.id))}
                  disabled={isPending}
                  title="Add-on"
                  className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-[10px] leading-none font-medium">Add-on</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => run(() => eliminatePlayer(participant.id))}
                disabled={isPending}
                title="Eliminar"
                className="inline-flex flex-col items-center gap-0.5 rounded-md border border-destructive/30 px-2 py-1 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:pointer-events-none"
              >
                <Skull className="h-3.5 w-3.5" />
                <span className="text-[10px] leading-none font-medium">Eliminar</span>
              </button>
            </>
          )}
          {(isEliminated || isFinished) && (
            <button
              type="button"
              onClick={() => run(() => undoElimination(participant.id))}
              disabled={isPending}
              title="Desfazer eliminacao"
              className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-[10px] leading-none font-medium">Desfazer</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function QuickActions({ participants, tournament }: QuickActionsProps) {
  const active = participants.filter(
    (p) => p.status === "registered" || p.status === "playing" || p.status === "eliminated" || p.status === "finished"
  );

  if (active.length === 0) return null;

  const showRebuy = tournament.rebuyAmount > 0;
  const showAddon = tournament.allowAddon;

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="py-2 pr-3 pl-4 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
              <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Jogador</th>
              {showRebuy && (
                <th className="py-2 pr-3 text-center text-xs font-medium text-muted-foreground">Rebuys</th>
              )}
              {showAddon && (
                <th className="py-2 pr-3 text-center text-xs font-medium text-muted-foreground">Add-on</th>
              )}
              <th className="py-2 pr-3 text-right text-xs font-medium text-muted-foreground">Total</th>
              <th className="py-2 pr-4 text-right text-xs font-medium text-muted-foreground">Acoes</th>
            </tr>
          </thead>
          <tbody className="px-4">
            {active.map((p) => (
              <ParticipantRowFiltered
                key={p.id}
                participant={p}
                tournament={tournament}
                showRebuy={showRebuy}
                showAddon={showAddon}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParticipantRowFiltered({
  participant,
  tournament,
  showRebuy,
  showAddon,
}: {
  participant: Participant;
  tournament: Tournament;
  showRebuy: boolean;
  showAddon: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ error?: string } | { success: boolean } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const isRegistered = participant.status === "registered";
  const isPlaying = participant.status === "playing";
  const isEliminated = participant.status === "eliminated";
  const isFinished = participant.status === "finished";

  const totalPaid =
    (participant.buyInPaid ? tournament.buyInAmount : 0) +
    participant.rebuyCount * tournament.rebuyAmount +
    (participant.addonUsed ? tournament.addonAmount : 0);

  return (
    <tr className={`border-b last:border-0 ${isEliminated ? "opacity-50" : ""}`}>
      <td className="py-2 pr-3 pl-4 whitespace-nowrap">
        {isFinished ? (
          <span className="text-sm">🏆 1º</span>
        ) : isEliminated && participant.finishPosition ? (
          <span className="text-sm text-muted-foreground">{participant.finishPosition}º</span>
        ) : isRegistered ? (
          <Badge variant="outline" className="text-xs text-muted-foreground">Aguardando</Badge>
        ) : (
          <Badge variant="default" className="text-xs">Jogando</Badge>
        )}
      </td>

      <td className="py-2 pr-3 text-sm font-medium max-w-[160px]">
        <span className="truncate block">{displayName(participant)}</span>
      </td>

      {showRebuy && (
        <td className="py-2 pr-3 text-sm text-center text-muted-foreground">
          {participant.rebuyCount > 0 ? participant.rebuyCount : "—"}
        </td>
      )}

      {showAddon && (
        <td className="py-2 pr-3 text-sm text-center text-muted-foreground">
          {participant.addonUsed ? "Sim" : "—"}
        </td>
      )}

      <td className="py-2 pr-3 text-sm text-right text-muted-foreground whitespace-nowrap">
        {formatCurrency(totalPaid)}
      </td>

      <td className="py-2 pr-4">
        <div className="flex items-center justify-end gap-1">
          {isRegistered && (
            <button
              type="button"
              onClick={() => run(() => confirmBuyIn(participant.id))}
              disabled={isPending}
              title="Confirmar Buy-in"
              className="inline-flex flex-col items-center gap-0.5 rounded-md border border-green-600/40 px-2 py-1 text-green-600 transition-colors hover:bg-green-600 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="text-[10px] leading-none font-medium">Buy-in</span>
            </button>
          )}
          {isPlaying && (
            <>
              {tournament.rebuyAmount > 0 && (
                <button
                  type="button"
                  onClick={() => run(() => addRebuy(participant.id))}
                  disabled={isPending}
                  title="Rebuy"
                  className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="text-[10px] leading-none font-medium">Rebuy</span>
                </button>
              )}
              {tournament.allowAddon && !participant.addonUsed && (
                <button
                  type="button"
                  onClick={() => run(() => addAddon(participant.id))}
                  disabled={isPending}
                  title="Add-on"
                  className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-[10px] leading-none font-medium">Add-on</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => run(() => eliminatePlayer(participant.id))}
                disabled={isPending}
                title="Eliminar"
                className="inline-flex flex-col items-center gap-0.5 rounded-md border border-destructive/30 px-2 py-1 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:pointer-events-none"
              >
                <Skull className="h-3.5 w-3.5" />
                <span className="text-[10px] leading-none font-medium">Eliminar</span>
              </button>
            </>
          )}
          {(isEliminated || isFinished) && (
            <button
              type="button"
              onClick={() => run(() => undoElimination(participant.id))}
              disabled={isPending}
              title="Desfazer eliminacao"
              className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-[10px] leading-none font-medium">Desfazer</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

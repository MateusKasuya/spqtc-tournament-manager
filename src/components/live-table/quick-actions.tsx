"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminatePlayer, addRebuy, addDoubleRebuy, addAddon, undoElimination, undoRebuy, undoAddon, confirmBuyIn, addBonusChip, undoBonusChip } from "@/actions/participants";
import { Skull, RefreshCw, Plus, RotateCcw, CheckCircle, Zap } from "lucide-react";
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
  bonusChipUsed: boolean;
}

interface Tournament {
  rebuyAmount: number;
  addonAmount: number;
  allowAddon: boolean;
  bonusChipAmount: number;
  buyInAmount: number;
}

interface QuickActionsProps {
  participants: Participant[];
  tournament: Tournament;
}

function displayName(p: { name: string; nickname: string | null }) {
  return p.nickname ?? p.name;
}

export function QuickActions({ participants, tournament }: QuickActionsProps) {
  const active = participants.filter(
    (p) => p.status === "registered" || p.status === "playing" || p.status === "eliminated" || p.status === "finished"
  );

  if (active.length === 0) return null;

  const showRebuy = tournament.rebuyAmount > 0;
  const showAddon = tournament.allowAddon;
  const showBonus = tournament.bonusChipAmount > 0;

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-base">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="py-2.5 pr-3 pl-4 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">Status</th>
              <th className="py-2.5 pr-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">Jogador</th>
              {showRebuy && (
                <th className="py-2.5 pr-3 text-center text-sm font-medium text-muted-foreground whitespace-nowrap">Rebuys</th>
              )}
              {showAddon && (
                <th className="py-2.5 pr-3 text-center text-sm font-medium text-muted-foreground whitespace-nowrap">Add-on</th>
              )}
              {showBonus && (
                <th className="py-2.5 pr-3 text-center text-sm font-medium text-muted-foreground whitespace-nowrap">Bonus</th>
              )}
              <th className="py-2.5 pr-3 text-right text-sm font-medium text-muted-foreground whitespace-nowrap">Total</th>
              <th className="py-2.5 pr-4 text-right text-sm font-medium text-muted-foreground whitespace-nowrap">Ações</th>
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
                showBonus={showBonus}
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
  showBonus,
}: {
  participant: Participant;
  tournament: Tournament;
  showRebuy: boolean;
  showAddon: boolean;
  showBonus: boolean;
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
      <td className="py-2.5 pr-3 pl-4 whitespace-nowrap">
        {isFinished ? (
          <span className="text-base">🏆 1º</span>
        ) : isEliminated && participant.finishPosition ? (
          <span className="text-base text-muted-foreground">{participant.finishPosition}º</span>
        ) : isRegistered ? (
          <Badge variant="outline" className="text-sm text-muted-foreground">Aguardando</Badge>
        ) : (
          <Badge variant="default" className="text-sm">Jogando</Badge>
        )}
      </td>

      <td className="py-2.5 pr-3 text-base font-medium max-w-[160px]">
        <span className="truncate block">{displayName(participant)}</span>
      </td>

      {showRebuy && (
        <td className="py-2.5 pr-3 text-base text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-1">
            <span>{participant.rebuyCount > 0 ? participant.rebuyCount : "—"}</span>
            {participant.rebuyCount > 0 && (
              <button
                type="button"
                onClick={() => run(() => undoRebuy(participant.id))}
                disabled={isPending}
                title="Desfazer rebuy"
                className="inline-flex items-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      )}

      {showAddon && (
        <td className="py-2.5 pr-3 text-base text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-1">
            <span>{participant.addonUsed ? "Sim" : "—"}</span>
            {participant.addonUsed && (
              <button
                type="button"
                onClick={() => run(() => undoAddon(participant.id))}
                disabled={isPending}
                title="Desfazer add-on"
                className="inline-flex items-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      )}

      {showBonus && (
        <td className="py-2.5 pr-3 text-base text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-1">
            <span>{participant.bonusChipUsed ? "Sim" : "—"}</span>
            {participant.bonusChipUsed && (
              <button
                type="button"
                onClick={() => run(() => undoBonusChip(participant.id))}
                disabled={isPending}
                title="Desfazer bonus chip"
                className="inline-flex items-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      )}

      <td className="py-2.5 pr-3 text-base text-right text-muted-foreground whitespace-nowrap">
        {formatCurrency(totalPaid)}
      </td>

      <td className="py-2.5 pr-4">
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          {isRegistered && (
            <button
              type="button"
              onClick={() => run(() => confirmBuyIn(participant.id))}
              disabled={isPending}
              title="Confirmar Buy-in"
              className="inline-flex flex-col items-center gap-0.5 rounded-md border border-green-600/40 px-2.5 py-1.5 text-green-600 transition-colors hover:bg-green-600 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs leading-none font-medium">Buy-in</span>
            </button>
          )}
          {isPlaying && (
            <>
              {tournament.rebuyAmount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => run(() => addRebuy(participant.id))}
                    disabled={isPending}
                    title="Rebuy"
                    className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-xs leading-none font-medium">Rebuy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => addDoubleRebuy(participant.id))}
                    disabled={isPending}
                    title="Rebuy Duplo"
                    className="inline-flex flex-col items-center gap-0.5 rounded-md border border-blue-500/40 px-2.5 py-1.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-600 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-xs leading-none font-medium">2x Rebuy</span>
                  </button>
                </>
              )}
              {tournament.allowAddon && !participant.addonUsed && (
                <button
                  type="button"
                  onClick={() => run(() => addAddon(participant.id))}
                  disabled={isPending}
                  title="Add-on"
                  className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-xs leading-none font-medium">Add-on</span>
                </button>
              )}
              {showBonus && !participant.bonusChipUsed && (
                <button
                  type="button"
                  onClick={() => run(() => addBonusChip(participant.id))}
                  disabled={isPending}
                  title="Bonus chip"
                  className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Zap className="h-4 w-4" />
                  <span className="text-xs leading-none font-medium">Bonus</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => run(() => eliminatePlayer(participant.id))}
                disabled={isPending}
                title="Eliminar"
                className="inline-flex flex-col items-center gap-0.5 rounded-md border border-destructive/30 px-2.5 py-1.5 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:pointer-events-none"
              >
                <Skull className="h-4 w-4" />
                <span className="text-xs leading-none font-medium">Eliminar</span>
              </button>
            </>
          )}
          {(isEliminated || isFinished) && (
            <button
              type="button"
              onClick={() => run(() => undoElimination(participant.id))}
              disabled={isPending}
              title="Desfazer eliminacao"
              className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs leading-none font-medium">Desfazer</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

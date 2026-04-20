"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminatePlayer, addRebuy, addDoubleRebuy, addAddon, undoElimination, undoRebuy, undoAddon, confirmBuyIn, addBonusChip, undoBonusChip } from "@/actions/participants";
import { Skull, RefreshCw, Plus, RotateCcw, CheckCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Participant {
  id: number;
  playerId: number;
  name: string;
  nickname: string | null;
  status: string;
  finishPosition: number | null;
  buyInPaid: boolean;
  rebuyCount: number;
  addonUsed: boolean;
  bonusChipUsed: boolean;
  currentBounty?: number;
  bountiesCollected?: number;
}

interface Tournament {
  rebuyAmount: number;
  addonAmount: number;
  allowAddon: boolean;
  bonusChipAmount: number;
  buyInAmount: number;
  tournamentType?: string;
}

interface QuickActionsProps {
  participants: Participant[];
  tournament: Tournament;
}

function displayName(p: { name: string; nickname: string | null }) {
  return p.nickname ?? p.name;
}

// Dialog for selecting eliminators in bounty mode
function EliminatorDialog({
  open,
  onClose,
  onConfirm,
  allParticipants,
  victimId,
  actionLabel,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (eliminatorIds: number[]) => void;
  allParticipants: Participant[];
  victimId: number;
  actionLabel: string;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const playing = allParticipants.filter((p) => p.status === "playing" && p.id !== victimId);

  function toggle(playerId: number) {
    setSelected((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  }

  function handleConfirm() {
    if (selected.length === 0) return;
    onConfirm(selected);
    setSelected([]);
  }

  function handleClose() {
    setSelected([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quem eliminou?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Selecione um ou mais eliminadores:</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {playing.map((p) => (
              <label key={p.id} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent">
                <input
                  type="checkbox"
                  checked={selected.includes(p.playerId)}
                  onChange={() => toggle(p.playerId)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">{displayName(p)}</span>
                {p.currentBounty != null && p.currentBounty > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Bounty: {formatCurrency(p.currentBounty)}
                  </span>
                )}
              </label>
            ))}
            {playing.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum jogador disponivel</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={selected.length === 0 || isPending}>
              {isPending ? "Processando..." : actionLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickActions({ participants, tournament }: QuickActionsProps) {
  const active = participants.filter(
    (p) => p.status === "registered" || p.status === "playing" || p.status === "eliminated" || p.status === "finished"
  );

  if (active.length === 0) return null;

  const showRebuy = tournament.rebuyAmount > 0;
  const showAddon = tournament.allowAddon;
  const showBonus = tournament.bonusChipAmount > 0;
  const isBounty = tournament.tournamentType === "bounty_builder";

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-base">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="py-2.5 pr-3 pl-4 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">Status</th>
              <th className="py-2.5 pr-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">Jogador</th>
              {isBounty && (
                <th className="py-2.5 pr-3 text-right text-sm font-medium text-muted-foreground whitespace-nowrap">Bounty</th>
              )}
              {isBounty && (
                <th className="py-2.5 pr-3 text-right text-sm font-medium text-muted-foreground whitespace-nowrap">Faturado</th>
              )}
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
                isBounty={isBounty}
                allParticipants={active}
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
  isBounty,
  allParticipants,
}: {
  participant: Participant;
  tournament: Tournament;
  showRebuy: boolean;
  showAddon: boolean;
  showBonus: boolean;
  isBounty: boolean;
  allParticipants: Participant[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [dialogAction, setDialogAction] = useState<"rebuy" | "doubleRebuy" | "eliminate" | null>(null);

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

  function handleBountyAction(action: "rebuy" | "doubleRebuy" | "eliminate", eliminatorIds: number[]) {
    setDialogAction(null);
    if (action === "rebuy") {
      run(() => addRebuy(participant.id, eliminatorIds));
    } else if (action === "doubleRebuy") {
      run(() => addDoubleRebuy(participant.id, eliminatorIds));
    } else {
      run(() => eliminatePlayer(participant.id, eliminatorIds));
    }
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
    <>
      {isBounty && dialogAction && (
        <EliminatorDialog
          open={true}
          onClose={() => setDialogAction(null)}
          onConfirm={(ids) => handleBountyAction(dialogAction, ids)}
          allParticipants={allParticipants}
          victimId={participant.id}
          actionLabel={dialogAction === "rebuy" ? "Rebuy" : dialogAction === "doubleRebuy" ? "2x Rebuy" : "Eliminar"}
          isPending={isPending}
        />
      )}
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

        {isBounty && (
          <td className="py-2.5 pr-3 text-base text-right text-muted-foreground whitespace-nowrap">
            {isPlaying || isRegistered
              ? formatCurrency(participant.currentBounty ?? 0)
              : "—"}
          </td>
        )}

        {isBounty && (
          <td className="py-2.5 pr-3 text-base text-right text-muted-foreground whitespace-nowrap">
            {formatCurrency(participant.bountiesCollected ?? 0)}
          </td>
        )}

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
                      onClick={() => isBounty ? setDialogAction("rebuy") : run(() => addRebuy(participant.id))}
                      disabled={isPending}
                      title="Rebuy"
                      className="inline-flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="text-xs leading-none font-medium">Rebuy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => isBounty ? setDialogAction("doubleRebuy") : run(() => addDoubleRebuy(participant.id))}
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
                  onClick={() => isBounty ? setDialogAction("eliminate") : run(() => eliminatePlayer(participant.id))}
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
    </>
  );
}

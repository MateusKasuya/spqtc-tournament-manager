"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  confirmBuyIn,
  undoBuyIn,
  addRebuy,
  addDoubleRebuy,
  addAddon,
  undoRebuy,
  undoAddon,
  addBonusChip,
  undoBonusChip,
  eliminatePlayer,
  undoElimination,
  removeParticipant,
} from "@/actions/participants";
import { formatCurrency } from "@/lib/format";
import { Trophy, Skull, RotateCcw, Trash2, DollarSign, RefreshCw, Plus, Zap } from "lucide-react";
import { toast } from "sonner";

interface Participant {
  id: number;
  playerId: number;
  name: string;
  nickname: string | null;
  buyInPaid: boolean;
  rebuyCount: number;
  addonCount: number;
  bonusChipUsed: boolean;
  finishPosition: number | null;
  prizeAmount: number;
  status: string;
  currentBounty?: number;
  bountiesCollected?: number;
}

interface ParticipantListProps {
  participants: Participant[];
  isAdmin: boolean;
  allowAddon: boolean;
  bonusChipAmount: number;
  buyInAmount: number;
  rebuyAmount: number;
  addonAmount: number;
  isBounty?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  registered: { label: "Registrado", variant: "secondary" },
  playing: { label: "Jogando", variant: "default" },
  eliminated: { label: "Eliminado", variant: "destructive" },
  finished: { label: "Finalizado", variant: "outline" },
};

function ActionButton({
  onClick,
  disabled,
  label,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1 transition-colors disabled:opacity-40 disabled:pointer-events-none
        ${destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
    >
      {children}
      <span className="text-[10px] leading-none font-medium">{label}</span>
    </button>
  );
}

function ParticipantActions({
  participant,
  allowAddon,
  bonusChipAmount,
}: {
  participant: Participant;
  allowAddon: boolean;
  bonusChipAmount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | { success: boolean } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) toast.error(result.error);
    });
  }

  const canUndoBuyIn =
    participant.status === "playing" &&
    participant.rebuyCount === 0 &&
    participant.addonCount === 0 &&
    !participant.bonusChipUsed &&
    (participant.bountiesCollected ?? 0) === 0;

  return (
    <div className="flex items-center gap-1">
      {participant.status === "registered" && !participant.buyInPaid && (
        <ActionButton
          onClick={() => run(() => confirmBuyIn(participant.id))}
          disabled={isPending}
          label="Confirmar buy-in"
        >
          <DollarSign className="h-3.5 w-3.5" />
        </ActionButton>
      )}

      {participant.status === "playing" && (
        <>
          {canUndoBuyIn && (
            <ActionButton
              onClick={() => run(() => undoBuyIn(participant.id))}
              disabled={isPending}
              label="-Buy-in"
              destructive
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          <ActionButton
            onClick={() => run(() => addRebuy(participant.id))}
            disabled={isPending}
            label="Rebuy"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </ActionButton>

          <ActionButton
            onClick={() => run(() => addDoubleRebuy(participant.id))}
            disabled={isPending}
            label="2x Rebuy"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </ActionButton>

          {participant.rebuyCount > 0 && (
            <ActionButton
              onClick={() => run(() => undoRebuy(participant.id))}
              disabled={isPending}
              label="-Rebuy"
              destructive
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          {allowAddon && (
            <ActionButton
              onClick={() => run(() => addAddon(participant.id))}
              disabled={isPending}
              label="Add-on"
            >
              <Plus className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          {allowAddon && participant.addonCount > 0 && (
            <ActionButton
              onClick={() => run(() => undoAddon(participant.id))}
              disabled={isPending}
              label="-Add-on"
              destructive
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          {bonusChipAmount > 0 && !participant.bonusChipUsed && (
            <ActionButton
              onClick={() => run(() => addBonusChip(participant.id))}
              disabled={isPending}
              label="Bonus"
            >
              <Zap className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          {bonusChipAmount > 0 && participant.bonusChipUsed && (
            <ActionButton
              onClick={() => run(() => undoBonusChip(participant.id))}
              disabled={isPending}
              label="-Bonus"
              destructive
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          <ActionButton
            onClick={() => run(() => eliminatePlayer(participant.id))}
            disabled={isPending}
            label="Eliminar"
            destructive
          >
            <Skull className="h-3.5 w-3.5" />
          </ActionButton>
        </>
      )}

      {participant.status === "eliminated" && (
        <ActionButton
          onClick={() => run(() => undoElimination(participant.id))}
          disabled={isPending}
          label="Desfazer eliminacao"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </ActionButton>
      )}

      {participant.status === "registered" && (
        <ActionButton
          onClick={() => run(() => removeParticipant(participant.id))}
          disabled={isPending}
          label="Remover jogador"
          destructive
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ActionButton>
      )}
    </div>
  );
}

export function ParticipantList({
  participants,
  isAdmin,
  allowAddon,
  bonusChipAmount,
  buyInAmount,
  rebuyAmount,
  addonAmount,
  isBounty,
}: ParticipantListProps) {
  if (participants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum jogador inscrito ainda
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {participants.map((p) => {
        const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.registered;
        const displayName = p.nickname ?? p.name;
        const total =
          (p.buyInPaid ? buyInAmount : 0) +
          p.rebuyCount * rebuyAmount +
          p.addonCount * addonAmount;

        return (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {p.finishPosition === 1 && (
                <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
              )}
              {p.finishPosition && p.finishPosition > 1 && (
                <span className="text-sm text-muted-foreground shrink-0 w-5 text-center">
                  {p.finishPosition}º
                </span>
              )}
              {!p.finishPosition && (
                <span className="w-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {total > 0 ? formatCurrency(total) : "Nao pago"}
                  {p.rebuyCount > 0 && ` · ${p.rebuyCount}R`}
                  {p.addonCount > 0 && ` · ${p.addonCount === 1 ? "A" : `${p.addonCount}A`}`}
                  {p.bonusChipUsed && " · B"}
                  {isBounty && p.currentBounty != null && p.currentBounty > 0 && ` · Bounty: ${formatCurrency(p.currentBounty)}`}
                  {isBounty && p.bountiesCollected != null && p.bountiesCollected > 0 && ` · Fat: ${formatCurrency(p.bountiesCollected)}`}
                  {p.prizeAmount > 0 && ` · Premio: ${formatCurrency(p.prizeAmount)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end sm:shrink-0 sm:flex-nowrap">
              {isAdmin && <ParticipantActions participant={p} allowAddon={allowAddon} bonusChipAmount={bonusChipAmount} />}
              <Badge variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  confirmBuyIn,
  addRebuy,
  addAddon,
  eliminatePlayer,
  undoElimination,
  removeParticipant,
} from "@/actions/participants";
import { formatCurrency } from "@/lib/format";
import { Trophy, Skull, RotateCcw, Trash2, DollarSign, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

interface Participant {
  id: number;
  userId: string;
  name: string;
  nickname: string | null;
  buyInPaid: boolean;
  rebuyCount: number;
  addonUsed: boolean;
  finishPosition: number | null;
  prizeAmount: number;
  status: string;
}

interface ParticipantListProps {
  participants: Participant[];
  isAdmin: boolean;
  allowAddon: boolean;
  buyInAmount: number;
  rebuyAmount: number;
  addonAmount: number;
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
  title,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none
        ${destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
    >
      {children}
    </button>
  );
}

function ParticipantActions({
  participant,
  allowAddon,
}: {
  participant: Participant;
  allowAddon: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | { success: boolean } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      {participant.status === "registered" && !participant.buyInPaid && (
        <ActionButton
          onClick={() => run(() => confirmBuyIn(participant.id))}
          disabled={isPending}
          title="Confirmar buy-in"
        >
          <DollarSign className="h-3.5 w-3.5" />
        </ActionButton>
      )}

      {participant.status === "playing" && (
        <>
          <ActionButton
            onClick={() => run(() => addRebuy(participant.id))}
            disabled={isPending}
            title="Rebuy"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </ActionButton>

          {allowAddon && !participant.addonUsed && (
            <ActionButton
              onClick={() => run(() => addAddon(participant.id))}
              disabled={isPending}
              title="Add-on"
            >
              <Plus className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          <ActionButton
            onClick={() => run(() => eliminatePlayer(participant.id))}
            disabled={isPending}
            title="Eliminar"
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
          title="Desfazer eliminacao"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </ActionButton>
      )}

      {participant.status === "registered" && (
        <ActionButton
          onClick={() => run(() => removeParticipant(participant.id))}
          disabled={isPending}
          title="Remover jogador"
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
  buyInAmount,
  rebuyAmount,
  addonAmount,
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
        const displayName = p.nickname ? `${p.name} (${p.nickname})` : p.name;
        const total =
          (p.buyInPaid ? buyInAmount : 0) +
          p.rebuyCount * rebuyAmount +
          (p.addonUsed ? addonAmount : 0);

        return (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
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
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {total > 0 ? formatCurrency(total) : "Nao pago"}
                  {p.rebuyCount > 0 && ` · ${p.rebuyCount}R`}
                  {p.addonUsed && " · A"}
                  {p.prizeAmount > 0 && ` · Premio: ${formatCurrency(p.prizeAmount)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && <ParticipantActions participant={p} allowAddon={allowAddon} />}
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

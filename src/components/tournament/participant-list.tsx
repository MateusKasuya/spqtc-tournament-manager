"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  confirmBuyIn,
  addRebuy,
  addAddon,
  eliminatePlayer,
  undoElimination,
  removeParticipant,
} from "@/actions/participants";
import { formatCurrency } from "@/lib/format";
import { MoreHorizontal, Trophy, Skull, RotateCcw, Trash2, DollarSign, RefreshCw, Plus } from "lucide-react";
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
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!participant.buyInPaid && participant.status === "registered" && (
          <DropdownMenuItem onClick={() => run(() => confirmBuyIn(participant.id))}>
            <DollarSign className="h-4 w-4 mr-2" />
            Confirmar buy-in
          </DropdownMenuItem>
        )}
        {participant.status === "playing" && (
          <>
            <DropdownMenuItem onClick={() => run(() => addRebuy(participant.id))}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rebuy
            </DropdownMenuItem>
            {allowAddon && !participant.addonUsed && (
              <DropdownMenuItem onClick={() => run(() => addAddon(participant.id))}>
                <Plus className="h-4 w-4 mr-2" />
                Add-on
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => run(() => eliminatePlayer(participant.id))}
            >
              <Skull className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </>
        )}
        {participant.status === "eliminated" && (
          <DropdownMenuItem onClick={() => run(() => undoElimination(participant.id))}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Desfazer eliminacao
          </DropdownMenuItem>
        )}
        {participant.status === "registered" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => run(() => removeParticipant(participant.id))}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
              <Badge variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
              {isAdmin && <ParticipantActions participant={p} allowAddon={allowAddon} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

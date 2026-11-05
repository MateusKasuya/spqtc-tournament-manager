"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateTournamentStatus } from "@/actions/tournaments";
import type { TournamentStatus } from "@/lib/tournament-status";
import { toast } from "sonner";
import { PlayCircle, FlagTriangleRight, type LucideIcon } from "lucide-react";

// Qual avanço o botão oferece é escolha de UI; o servidor recusa transição inválida.
const NEXT_STATUS: Partial<Record<TournamentStatus, { value: TournamentStatus; label: string; icon: LucideIcon }>> = {
  pending: { value: "running", label: "Iniciar torneio", icon: PlayCircle },
  running: { value: "finished", label: "Encerrar torneio", icon: FlagTriangleRight },
};

interface TournamentStatusButtonProps {
  tournamentId: number;
  currentStatus: TournamentStatus;
}

export function TournamentStatusButton({ tournamentId, currentStatus }: TournamentStatusButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const next = NEXT_STATUS[currentStatus];
  if (!next) return null;

  const { value: nextStatus, label, icon: Icon } = next;
  const needsConfirmation = nextStatus === "finished";

  function handleAdvance() {
    startTransition(async () => {
      const result = await updateTournamentStatus(tournamentId, nextStatus);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          nextStatus === "running" ? "Torneio iniciado!" : "Torneio encerrado!"
        );
      }
      setConfirmOpen(false);
    });
  }

  if (needsConfirmation) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
        >
          <Icon className="h-4 w-4 mr-2" />
          {label}
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Encerrar torneio</DialogTitle>
              <DialogDescription>
                Tem certeza? Isso vai calcular e distribuir os pontos da temporada. Essa acao nao pode ser desfeita facilmente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleAdvance} disabled={isPending}>
                {isPending ? "Encerrando..." : "Sim, encerrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button
      size="sm"
      variant="default"
      onClick={handleAdvance}
      disabled={isPending}
    >
      <Icon className="h-4 w-4 mr-2" />
      {isPending ? "Aguarde..." : label}
    </Button>
  );
}

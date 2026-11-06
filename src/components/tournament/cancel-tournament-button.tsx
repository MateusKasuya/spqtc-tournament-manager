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
import { TOURNAMENT_STATUS_TRANSITIONS, type TournamentStatus } from "@/lib/tournament-status";
import { toast } from "sonner";
import { Ban } from "lucide-react";

interface CancelTournamentButtonProps {
  tournamentId: number;
  currentStatus: TournamentStatus;
}

// Cancelado é final: é a saída de um torneio Pendente ou Rodando que não vai
// acontecer (e, cancelado, ele pode ser excluído).
export function CancelTournamentButton({ tournamentId, currentStatus }: CancelTournamentButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!TOURNAMENT_STATUS_TRANSITIONS[currentStatus].includes("cancelled")) return null;

  function handleCancel() {
    startTransition(async () => {
      const result = await updateTournamentStatus(tournamentId, "cancelled");
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Torneio cancelado!");
      }
      setConfirmOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)} disabled={isPending}>
        <Ban className="h-4 w-4 mr-2" />
        Cancelar torneio
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar torneio</DialogTitle>
            <DialogDescription>
              Tem certeza? Um torneio cancelado nao volta a rodar e nao da pontos no ranking da temporada.
              Essa acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? "Cancelando..." : "Sim, cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

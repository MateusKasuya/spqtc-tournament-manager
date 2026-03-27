"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteTournament } from "@/actions/tournaments";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteTournamentButtonProps {
  tournamentId: number;
}

export function DeleteTournamentButton({ tournamentId }: DeleteTournamentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTournament(tournamentId);
      if (result && "error" in result) {
        toast.error(result.error);
        setOpen(false);
      }
      // Se sucesso, o server action faz redirect automaticamente
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={buttonVariants({ variant: "outline", size: "sm" }) + " text-destructive hover:text-destructive"}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir torneio</DialogTitle>
          <DialogDescription>
            Tem certeza? Essa acao nao pode ser desfeita. Todos os dados do torneio
            (blinds, premios, participantes) serao excluidos permanentemente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Excluindo..." : "Sim, excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

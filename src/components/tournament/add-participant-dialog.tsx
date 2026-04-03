"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { addParticipant } from "@/actions/participants";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Player {
  id: number;
  name: string;
  nickname: string | null;
}

interface AddParticipantDialogProps {
  tournamentId: number;
  availablePlayers: Player[];
}

export function AddParticipantDialog({ tournamentId, availablePlayers }: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const selectedPlayer = availablePlayers.find((p) => p.id === Number(selectedPlayerId)) ?? null;
  const selectedLabel = selectedPlayer
    ? selectedPlayer.nickname
      ? `${selectedPlayer.name} (${selectedPlayer.nickname})`
      : selectedPlayer.name
    : null;

  function handleAdd() {
    if (!selectedPlayerId) return;
    startTransition(async () => {
      const result = await addParticipant(tournamentId, Number(selectedPlayerId));
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Jogador adicionado!");
        setSelectedPlayerId("");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <UserPlus className="h-4 w-4 mr-2" />
        Adicionar jogador
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar jogador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Jogador</Label>
            <Select value={selectedPlayerId} onValueChange={(v) => setSelectedPlayerId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um jogador...">
                  {selectedLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Todos os jogadores ja estao inscritos
                  </p>
                ) : (
                  availablePlayers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nickname ? `${p.name} (${p.nickname})` : p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isPending || !selectedPlayerId}>
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

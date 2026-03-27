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

interface User {
  id: string;
  name: string;
  nickname: string | null;
}

interface AddParticipantDialogProps {
  tournamentId: number;
  availableUsers: User[];
}

export function AddParticipantDialog({ tournamentId, availableUsers }: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!selectedUserId) return;
    startTransition(async () => {
      const result = await addParticipant(tournamentId, selectedUserId);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Jogador adicionado!");
        setSelectedUserId("");
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
            <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um jogador..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Todos os jogadores ja estao inscritos
                  </p>
                ) : (
                  availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nickname ? `${u.name} (${u.nickname})` : u.name}
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
            <Button onClick={handleAdd} disabled={isPending || !selectedUserId}>
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

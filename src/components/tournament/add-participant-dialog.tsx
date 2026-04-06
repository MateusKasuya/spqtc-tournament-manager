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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { addParticipants } from "@/actions/participants";
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

function playerLabel(p: Player) {
  return p.nickname ? `${p.name} (${p.nickname})` : p.name;
}

export function AddParticipantDialog({ tournamentId, availablePlayers }: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  const filtered = availablePlayers.filter((p) =>
    playerLabel(p).toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setSearch("");
      setSelected(new Set());
    }
  }

  function handleAdd() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await addParticipants(tournamentId, Array.from(selected));
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          selected.size === 1 ? "Jogador adicionado!" : `${selected.size} jogadores adicionados!`
        );
        handleOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <UserPlus className="h-4 w-4 mr-2" />
        Adicionar jogador
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar jogadores</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Buscar jogador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos os jogadores ja estao inscritos
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum jogador encontrado
              </p>
            ) : (
              filtered.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <span className="text-sm">{playerLabel(p)}</span>
                </label>
              ))
            )}
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground">
              {selected.size} jogador{selected.size !== 1 ? "es" : ""} selecionado{selected.size !== 1 ? "s" : ""}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isPending || selected.size === 0}>
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

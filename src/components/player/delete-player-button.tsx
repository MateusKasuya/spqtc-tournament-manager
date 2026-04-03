"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deletePlayer } from "@/actions/players";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeletePlayerButtonProps {
  playerId: number;
}

export function DeletePlayerButton({ playerId }: DeletePlayerButtonProps) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePlayer(playerId);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Jogador removido!");
        setConfirm(false);
      }
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs px-2"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? "..." : "Confirmar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs px-2"
          onClick={() => setConfirm(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirm(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

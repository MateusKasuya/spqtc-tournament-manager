"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteSeason } from "@/actions/seasons";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface DeleteSeasonButtonProps {
  seasonId: number;
}

export function DeleteSeasonButton({ seasonId }: DeleteSeasonButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta temporada? Esta acao nao pode ser desfeita.")) return;

    startTransition(async () => {
      const result = await deleteSeason(seasonId);
      if ("error" in result) {
        toast.error(result.error);
      } else if ("success" in result) {
        toast.success(result.success);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

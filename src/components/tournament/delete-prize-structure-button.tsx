"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { deletePrizeStructure } from "@/actions/tournaments";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeletePrizeStructureButton({ tournamentId }: { tournamentId: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePrizeStructure(tournamentId);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Preset removido!");
        setOpen(false);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Trash2 className="h-4 w-4 mr-2" />
        Limpar preset
      </PopoverTrigger>
      <PopoverContent className="w-auto" side="bottom" align="end">
        <p className="text-sm font-medium mb-3">Remover preset de premios?</p>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
            Remover
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

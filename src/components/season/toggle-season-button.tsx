"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleSeasonActive } from "@/actions/seasons";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

interface ToggleSeasonButtonProps {
  seasonId: number;
}

export function ToggleSeasonButton({ seasonId }: ToggleSeasonButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleSeasonActive(seasonId);
      if ("error" in result) {
        toast.error(result.error);
      } else if ("success" in result) {
        toast.success(result.success);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <CheckCircle className="h-4 w-4 mr-1" />
      Ativar
    </Button>
  );
}

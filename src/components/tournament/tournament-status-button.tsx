"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateTournamentStatus } from "@/actions/tournaments";
import { toast } from "sonner";
import { PlayCircle, FlagTriangleRight, XCircle } from "lucide-react";

const NEXT_STATUS = {
  pending: { value: "running", label: "Iniciar torneio", icon: PlayCircle },
  running: { value: "finished", label: "Encerrar torneio", icon: FlagTriangleRight },
} as const;

interface TournamentStatusButtonProps {
  tournamentId: number;
  currentStatus: "pending" | "running" | "finished" | "cancelled";
}

export function TournamentStatusButton({ tournamentId, currentStatus }: TournamentStatusButtonProps) {
  const [isPending, startTransition] = useTransition();

  const next = NEXT_STATUS[currentStatus as keyof typeof NEXT_STATUS];
  if (!next) return null;

  const Icon = next.icon;

  function handleAdvance() {
    startTransition(async () => {
      const result = await updateTournamentStatus(tournamentId, next.value as "running" | "finished");
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          next.value === "running" ? "Torneio iniciado!" : "Torneio encerrado!"
        );
      }
    });
  }

  return (
    <Button
      size="sm"
      variant={next.value === "finished" ? "outline" : "default"}
      onClick={handleAdvance}
      disabled={isPending}
    >
      <Icon className="h-4 w-4 mr-2" />
      {isPending ? "Aguarde..." : next.label}
    </Button>
  );
}

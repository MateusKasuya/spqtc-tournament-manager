"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { selfRegister } from "@/actions/participants";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SelfRegisterButtonProps {
  tournamentId: number;
}

export function SelfRegisterButton({ tournamentId }: SelfRegisterButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRegister() {
    startTransition(async () => {
      const result = await selfRegister(tournamentId);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Inscricao realizada! O admin confirmara seu buy-in no dia.");
        router.refresh();
      }
    });
  }

  return (
    <Button onClick={handleRegister} disabled={isPending} className="w-full">
      {isPending ? "Inscrevendo..." : "Inscrever-se"}
    </Button>
  );
}

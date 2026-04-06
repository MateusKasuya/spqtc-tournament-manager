"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import Link from "next/link";

export default function TournamentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <p className="text-sm font-medium">Erro ao carregar o torneio.</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        {error.message || "Ocorreu um erro inesperado. Tente novamente."}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          Tentar novamente
        </Button>
        <Link href="/torneios" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Voltar
        </Link>
      </div>
    </div>
  );
}

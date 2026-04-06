"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
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
      <p className="text-sm font-medium">Algo deu errado.</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        {error.message || "Ocorreu um erro inesperado. Tente novamente."}
      </p>
      <Button size="sm" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}

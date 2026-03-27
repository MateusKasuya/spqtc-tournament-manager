"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";

interface CopyInviteLinkButtonProps {
  tournamentId: number;
}

export function CopyInviteLinkButton({ tournamentId }: CopyInviteLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/torneios/${tournamentId}/inscricao`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2 text-green-500" />
          Copiado!
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-2" />
          Copiar link de inscricao
        </>
      )}
    </Button>
  );
}

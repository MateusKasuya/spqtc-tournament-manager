"use client";

import { useState, useTransition } from "react";
import { addRebuy, addDoubleRebuy, eliminatePlayer } from "@/actions/participants";
import { toast } from "sonner";

type ActionResult = { error?: string } | { success: boolean } | undefined;
type DialogAction = "rebuy" | "doubleRebuy" | "eliminate" | null;

export function useQuickActionRunner(
  participantId: number,
  onMutated: () => Promise<void>,
  onSuccess?: () => void,
) {
  const [isPending, startTransition] = useTransition();
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        await onMutated();
        onSuccess?.();
      }
    });
  }

  function handleBountyAction(
    action: "rebuy" | "doubleRebuy" | "eliminate",
    eliminatorIds: number[],
  ) {
    setDialogAction(null);
    if (action === "rebuy") {
      run(() => addRebuy(participantId, eliminatorIds));
    } else if (action === "doubleRebuy") {
      run(() => addDoubleRebuy(participantId, eliminatorIds));
    } else {
      run(() => eliminatePlayer(participantId, eliminatorIds));
    }
  }

  return { run, isPending, dialogAction, setDialogAction, handleBountyAction };
}

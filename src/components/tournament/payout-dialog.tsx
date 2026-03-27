"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { distributePayouts } from "@/actions/participants";
import { formatCurrency } from "@/lib/format";
import { Trophy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ParticipantOption {
  userId: string;
  name: string;
  nickname: string | null;
  finishPosition: number | null;
}

interface PrizePosition {
  position: number;
  percentage: number;
}

interface PayoutEntry {
  position: number;
  userId: string;
  amount: string;
}

interface PayoutDialogProps {
  tournamentId: number;
  prizePool: number;
  prizePositions: PrizePosition[];
  participants: ParticipantOption[];
}

export function PayoutDialog({
  tournamentId,
  prizePool,
  prizePositions,
  participants,
}: PayoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ranked = [...participants]
    .filter((p) => p.finishPosition !== null)
    .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99));

  const [entries, setEntries] = useState<PayoutEntry[]>(() =>
    prizePositions.map((p) => {
      const player = ranked.find((r) => r.finishPosition === p.position);
      const calculated = Math.round((prizePool * p.percentage) / 100);
      return {
        position: p.position,
        userId: player?.userId ?? "",
        amount: (calculated / 100).toFixed(2),
      };
    })
  );

  function updateEntry(index: number, field: "userId" | "amount", value: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }

  function addEntry() {
    const nextPos = entries.length > 0 ? Math.max(...entries.map((e) => e.position)) + 1 : 1;
    setEntries((prev) => [...prev, { position: nextPos, userId: "", amount: "" }]);
  }

  function removeEntry(index: number) {
    setEntries((prev) =>
      prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, position: i + 1 }))
    );
  }

  function handleDistribute() {
    startTransition(async () => {
      const payouts = entries
        .filter((e) => e.userId)
        .map((e) => ({
          userId: e.userId,
          amount: Math.round(parseFloat(e.amount.replace(",", ".") || "0") * 100),
          position: e.position,
        }));

      const result = await distributePayouts(tournamentId, payouts);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Premios distribuidos!");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Trophy className="h-4 w-4 mr-2" />
        Distribuir premios
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribuir premios</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Prize pool: <span className="font-semibold">{formatCurrency(prizePool)}</span>
          </p>
          <div className="space-y-3">
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhuma posicao adicionada. Clique em "Adicionar posicao" abaixo.
              </p>
            )}
            {entries.map((entry, index) => {
              const pct = prizePositions[index]?.percentage ?? 0;
              return (
                <div key={entry.position} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{entry.position}º lugar</span>
                    <div className="flex items-center gap-2">
                      {pct > 0 && <span className="text-xs text-muted-foreground">{pct}%</span>}
                      <button
                        type="button"
                        onClick={() => removeEntry(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Jogador</Label>
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={entry.userId}
                        onChange={(e) => updateEntry(index, "userId", e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {participants.map((p) => (
                          <option key={p.userId} value={p.userId}>
                            {p.nickname ? `${p.name} (${p.nickname})` : p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.amount}
                        onChange={(e) => updateEntry(index, "amount", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="w-full" onClick={addEntry}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar posicao
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDistribute} disabled={isPending}>
              {isPending ? "Distribuindo..." : "Distribuir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

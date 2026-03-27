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
import { saveTournamentResults } from "@/actions/tournaments";
import { formatCurrency } from "@/lib/format";
import { Plus, Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ResultEntry {
  position: number;
  amountPaid: string;
  notes: string;
}

interface TournamentResultsEditorProps {
  tournamentId: number;
  initialResults: { position: number; amountPaid: number; notes: string | null }[];
  prizeData: { position: number; percentage: number }[];
  buyInAmount: number;
}

export function TournamentResultsEditor({
  tournamentId,
  initialResults,
  prizeData,
  buyInAmount,
}: TournamentResultsEditorProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ResultEntry[]>(
    initialResults.length > 0
      ? initialResults.map((r) => ({
          position: r.position,
          amountPaid: (r.amountPaid / 100).toFixed(2),
          notes: r.notes ?? "",
        }))
      : prizeData.map((p) => ({
          position: p.position,
          amountPaid: "",
          notes: "",
        }))
  );
  const [isPending, startTransition] = useTransition();

  function updateResult(index: number, field: keyof ResultEntry, value: string) {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function addPosition() {
    const nextPos = results.length + 1;
    setResults((prev) => [...prev, { position: nextPos, amountPaid: "", notes: "" }]);
  }

  function removePosition(index: number) {
    setResults((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, position: i + 1 }))
    );
  }

  function handleSave() {
    startTransition(async () => {
      const parsed = results.map((r) => ({
        position: r.position,
        amountPaid: Math.round(parseFloat(r.amountPaid.replace(",", ".") || "0") * 100),
        notes: r.notes.trim() || null,
      }));

      const result = await saveTournamentResults(tournamentId, parsed);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Resultado salvo!");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Trophy className="h-4 w-4 mr-2" />
        {initialResults.length > 0 ? "Editar resultado" : "Registrar resultado"}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado do torneio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Registre os valores reais pagos. Use o campo de observacao para acordos.
          </p>

          <div className="space-y-3">
            {results.map((r, index) => (
              <div key={index} className="space-y-1.5 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.position}º lugar</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removePosition(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor pago (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={r.amountPaid}
                      onChange={(e) => updateResult(index, "amountPaid", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Obs. (acordos)</Label>
                    <Input
                      placeholder="Ex: acordo 3-way"
                      value={r.notes}
                      onChange={(e) => updateResult(index, "notes", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={addPosition}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar posicao
          </Button>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

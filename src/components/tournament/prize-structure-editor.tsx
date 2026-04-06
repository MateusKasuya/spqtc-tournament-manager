"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updatePrizeStructure } from "@/actions/tournaments";
import { savePrizeTemplate, deletePrizeTemplate } from "@/actions/prize-templates";
import { getDefaultPrizeStructure } from "@/lib/tournament-defaults";
import type { PrizeTemplateLevels } from "@/db/schema";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PrizePosition {
  position: number;
  percentage: number;
}

interface SavedTemplate {
  id: number;
  name: string;
  levels: PrizeTemplateLevels;
}

interface PrizeStructureEditorProps {
  tournamentId: number;
  initialPositions: PrizePosition[];
  savedTemplates?: SavedTemplate[];
}

export function PrizeStructureEditor({
  tournamentId,
  initialPositions,
  savedTemplates: initialTemplates = [],
}: PrizeStructureEditorProps) {
  const [open, setOpen] = useState(false);
  const [positions, setPositions] = useState<PrizePosition[]>(
    initialPositions.length > 0
      ? initialPositions
      : getDefaultPrizeStructure()
  );
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const total = positions.reduce((sum, p) => sum + p.percentage, 0);
  const selectedTemplateObj = templates.find((t) => String(t.id) === selectedTemplate);

  function updatePosition(index: number, percentage: number) {
    setPositions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, percentage } : p))
    );
  }

  function addPosition() {
    const nextPos = positions.length + 1;
    setPositions((prev) => [...prev, { position: nextPos, percentage: 0 }]);
  }

  function removePosition(index: number) {
    setPositions((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, position: i + 1 }))
    );
  }

  function loadTemplate(value: string) {
    setSelectedTemplate(value);
    if (value === "__default__") {
      setPositions(getDefaultPrizeStructure());
      return;
    }
    const t = templates.find((t) => String(t.id) === value);
    if (t) setPositions(t.levels.map((l, i) => ({ ...l, position: i + 1 })));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePrizeStructure(tournamentId, positions);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Estrutura de premios atualizada!");
        setOpen(false);
      }
    });
  }

  function handleSaveTemplate() {
    if (!templateName.trim()) return;
    startTransition(async () => {
      const result = await savePrizeTemplate(templateName, positions as PrizeTemplateLevels);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Template salvo!");
        setSavingTemplate(false);
        setTemplateName("");
        if ("template" in result && result.template) setTemplates((prev) => [result.template!, ...prev]);
      }
    });
  }

  function handleDeleteTemplate(id: number) {
    startTransition(async () => {
      const result = await deletePrizeTemplate(id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        setSelectedTemplate("");
        setDeletePopoverOpen(false);
        toast.success("Template removido!");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Pencil className="h-4 w-4 mr-2" />
        Editar Premios
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar estrutura de premios</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Templates */}
          <div className="flex items-center gap-2">
            <Select value={selectedTemplate} onValueChange={(v) => loadTemplate(v ?? "")}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Carregar template...">
                  {selectedTemplate === "__default__"
                    ? "Padrao"
                    : selectedTemplate
                    ? templates.find((t) => String(t.id) === selectedTemplate)?.name
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Padrao</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplateObj && (
              <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
                <PopoverTrigger className={buttonVariants({ variant: "outline", size: "icon" })}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent className="w-auto" side="bottom" align="end">
                  <p className="text-sm font-medium mb-3">
                    Excluir &ldquo;{selectedTemplateObj.name}&rdquo;?
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setDeletePopoverOpen(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTemplate(selectedTemplateObj.id)} disabled={isPending}>
                      Excluir
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Button size="sm" onClick={addPosition}>
              <Plus className="h-4 w-4 mr-1" />
              Posicao
            </Button>
          </div>

          {/* Posicoes */}
          <div className="space-y-2">
            {positions.map((pos, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium w-8 text-center">{pos.position}º</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={pos.percentage}
                  onChange={(e) => updatePosition(index, Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <span className="text-sm text-muted-foreground">%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removePosition(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className={`text-sm font-medium text-right ${Math.abs(total - 100) < 0.01 ? "text-green-600" : "text-destructive"}`}>
            Total: {total.toFixed(2)}%
          </div>

          {/* Salvar como template */}
          {savingTemplate ? (
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Nome do template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTemplate();
                  if (e.key === "Escape") setSavingTemplate(false);
                }}
                autoFocus
                className="flex-1"
              />
              <Button size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim() || isPending}>
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setSavingTemplate(false); setTemplateName(""); }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSavingTemplate(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar como template
            </button>
          )}

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

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
import { Checkbox } from "@/components/ui/checkbox";
import { updateBlindStructure } from "@/actions/tournaments";
import { saveBlindTemplate, deleteBlindTemplate } from "@/actions/blind-templates";
import { DEFAULT_BLIND_STRUCTURE } from "@/lib/tournament-defaults";
import type { BlindTemplateLevels } from "@/db/schema";
import { ChevronDown, ChevronUp, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
  isBreak: boolean;
  isAddonLevel: boolean;
  isBigAnte: boolean;
}

interface SavedTemplate {
  id: number;
  name: string;
  levels: BlindTemplateLevels;
}

interface BlindStructureEditorProps {
  tournamentId: number;
  initialLevels: BlindLevel[];
  savedTemplates: SavedTemplate[];
}

export function BlindStructureEditor({
  tournamentId,
  initialLevels,
  savedTemplates,
}: BlindStructureEditorProps) {
  const [open, setOpen] = useState(false);
  const [levels, setLevels] = useState<BlindLevel[]>(initialLevels);
  const [isPending, startTransition] = useTransition();
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templates, setTemplates] = useState(savedTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

  function updateLevel(index: number, field: keyof BlindLevel, value: number | boolean) {
    setLevels((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  function setAddonLevel(index: number) {
    setLevels((prev) =>
      prev.map((l, i) => ({ ...l, isAddonLevel: i === index ? !l.isAddonLevel : false }))
    );
  }

  function addLevel() {
    const nextLevel = levels.length + 1;
    setLevels((prev) => [
      ...prev,
      { level: nextLevel, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false },
    ]);
  }

  function removeLevel(index: number) {
    setLevels((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((l, i) => ({ ...l, level: i + 1 }))
    );
  }

  function moveLevel(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    setLevels((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((l, i) => ({ ...l, level: i + 1 }));
    });
  }

  function loadTemplate(value: string) {
    setSelectedTemplate(value);
    if (value === "__default__") {
      setLevels(DEFAULT_BLIND_STRUCTURE);
      return;
    }
    const template = templates.find((t) => String(t.id) === value);
    if (!template) return;
    setLevels(template.levels.map((l, i) => ({ ...l, level: i + 1 })));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateBlindStructure(tournamentId, levels);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Estrutura de blinds atualizada!");
        setOpen(false);
      }
    });
  }

  function handleSaveTemplate() {
    if (!templateName.trim()) return;
    startTransition(async () => {
      const result = await saveBlindTemplate(templateName, levels as BlindTemplateLevels);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Template salvo!");
        setSavingTemplate(false);
        setTemplateName("");
        if ("template" in result && result.template) {
          setTemplates((prev) => [result.template!, ...prev]);
        }
      }
    });
  }

  function handleDeleteTemplate(id: number) {
    startTransition(async () => {
      const result = await deleteBlindTemplate(id);
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

  const selectedTemplateObj = templates.find((t) => String(t.id) === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Pencil className="h-4 w-4 mr-2" />
        Editar Blinds
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar estrutura de blinds</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barra de templates + adicionar nivel */}
          <div className="flex items-center gap-2">
            <Select value={selectedTemplate} onValueChange={(v) => loadTemplate(v ?? "")}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Carregar template...">
                  {selectedTemplate === "__default__"
                    ? "Template padrao"
                    : selectedTemplate
                    ? templates.find((t) => String(t.id) === selectedTemplate)?.name
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Template padrao</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplateObj && (
              <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
                <PopoverTrigger
                  className={buttonVariants({ variant: "outline", size: "icon" })}
                >
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
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteTemplate(selectedTemplateObj.id)}
                      disabled={isPending}
                    >
                      Excluir
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Button size="sm" onClick={addLevel}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar nivel
            </Button>
          </div>

          {/* Tabela de niveis */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem_2.5rem_2.5rem_4.5rem] gap-1.5 text-xs font-medium text-muted-foreground px-1">
              <span>#</span>
              <span>BB</span>
              <span>Min</span>
              <span className="text-center">Big Ante</span>
              <span className="text-center">Break</span>
              <span className="text-center">Add-on</span>
              <span />
            </div>

            {levels.map((level, index) => (
              <div
                key={index}
                className={cn(
                  "grid grid-cols-[1.5rem_1fr_1fr_2.5rem_2.5rem_2.5rem_4.5rem] gap-1.5 items-center",
                  level.isAddonLevel && "bg-primary/5 rounded-md px-0.5"
                )}
              >
                <span className="text-xs text-muted-foreground text-center">
                  {level.level}
                </span>
                <Input
                  type="number"
                  min="0"
                  value={level.bigBlind}
                  onChange={(e) => updateLevel(index, "bigBlind", Number(e.target.value))}
                  disabled={level.isBreak}
                  className="h-8 px-1.5 text-sm text-center"
                />
                <Input
                  type="number"
                  min="1"
                  value={level.durationMinutes}
                  onChange={(e) => updateLevel(index, "durationMinutes", Number(e.target.value))}
                  className="h-8 px-1.5 text-sm text-center"
                />
                <div className="flex justify-center">
                  <Checkbox
                    checked={level.isBigAnte}
                    onCheckedChange={(checked) => updateLevel(index, "isBigAnte", !!checked)}
                    disabled={level.isBreak}
                  />
                </div>
                <div className="flex justify-center">
                  <Checkbox
                    checked={level.isBreak}
                    onCheckedChange={(checked) => updateLevel(index, "isBreak", !!checked)}
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setAddonLevel(index)}
                    className={cn(
                      "h-4 w-4 rounded-full border-2 transition-colors",
                      level.isAddonLevel
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40 hover:border-primary/60"
                    )}
                  />
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => moveLevel(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => moveLevel(index, "down")}
                    disabled={index === levels.length - 1}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLevel(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
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
              Salvar estrutura atual como template
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

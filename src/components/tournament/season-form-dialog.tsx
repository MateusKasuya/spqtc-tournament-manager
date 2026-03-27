"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSeason } from "@/actions/seasons";
import { toast } from "sonner";

interface SeasonFormDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export function SeasonFormDialog({ children, onCreated }: SeasonFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createSeason(formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Temporada criada!");
        setOpen(false);
        onCreated?.();
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova temporada</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="season-name">Nome</Label>
              <Input
                id="season-name"
                name="name"
                placeholder="Ex: Temporada 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-start">Data de inicio</Label>
              <Input
                id="season-start"
                name="startDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

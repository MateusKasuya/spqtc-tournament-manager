"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTournament, updateTournament } from "@/actions/tournaments";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Plus } from "lucide-react";
import { SeasonFormDialog } from "./season-form-dialog";

interface Season {
  id: number;
  name: string;
}


interface TournamentFormProps {
  seasons: Season[];
  initialData?: {
    id: number;
    name: string;
    date: Date;
    seasonId?: number | null;
    buyInAmount: number;
    rebuyAmount: number;
    addonAmount: number;
    initialChips: number;
    rebuyChips: number;
    addonChips: number;
    maxRebuys: number;
    allowAddon: boolean;
  };
}

/** Formata centavos para exibição em reais (ex: 5000 → "50.00") */
function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function TournamentForm({ seasons, initialData }: TournamentFormProps) {
  const action = initialData
    ? updateTournament.bind(null, initialData.id)
    : createTournament;

  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [allowAddon, setAllowAddon] = useState(initialData?.allowAddon ?? false);
  const [unlimited, setUnlimited] = useState(initialData ? initialData.maxRebuys === 0 : false);
  const [selectedSeason, setSelectedSeason] = useState(
    initialData?.seasonId?.toString() ?? ""
  );

  const [dateTime, setDateTime] = useState<Date | undefined>(
    initialData ? new Date(initialData.date) : (() => {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      return d;
    })()
  );

  const [name, setName] = useState(initialData?.name ?? "");
  const [initialChips, setInitialChips] = useState(
    String(initialData?.initialChips ?? 10000)
  );
  const [rebuyChips, setRebuyChips] = useState(
    String(initialData?.rebuyChips ?? 10000)
  );
  const [addonChips, setAddonChips] = useState(
    String(initialData?.addonChips ?? 10000)
  );
  const [maxRebuys, setMaxRebuys] = useState(
    String(initialData && initialData.maxRebuys > 0 ? initialData.maxRebuys : 2)
  );
  const [buyInAmount, setBuyInAmount] = useState(
    initialData ? centsToReais(initialData.buyInAmount) : "50.00"
  );
  const [rebuyAmount, setRebuyAmount] = useState(
    initialData ? centsToReais(initialData.rebuyAmount) : "30.00"
  );
  const [addonAmount, setAddonAmount] = useState(
    initialData ? centsToReais(initialData.addonAmount) : "30.00"
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const raw = new FormData(form);

    // Converter data do estado para ISO UTC
    if (dateTime) {
      raw.set("date", dateTime.toISOString());
    }

    // Converter R$ para centavos
    for (const field of ["buyInAmount", "rebuyAmount", "addonAmount"]) {
      const val = raw.get(field) as string;
      if (val !== null && val !== "") {
        raw.set(field, String(Math.round(parseFloat(val.replace(",", ".")) * 100)));
      }
    }

    // Max rebuys: ilimitado = 0
    if (unlimited) {
      raw.set("maxRebuys", "0");
    }

    // allowAddon como booleano
    raw.set("allowAddon", allowAddon ? "true" : "false");

    // Temporada selecionada
    if (selectedSeason) {
      raw.set("seasonId", selectedSeason);
    } else {
      raw.delete("seasonId");
    }

    startTransition(async () => {
      const result = await action(raw);
      if (result && "error" in result) {
        setError(result.error ?? "Erro desconhecido");
      }
      // Se sucesso, o server action faz redirect
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Informacoes basicas */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Informacoes basicas
        </h2>

        <div className="space-y-2">
          <Label htmlFor="name">Nome do torneio</Label>
          <Input
            id="name"
            name="name"
            placeholder="Ex: Torneio de Abril"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Temporada</Label>
            <SeasonFormDialog onCreated={() => router.refresh()}>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" />
                Nova temporada
              </button>
            </SeasonFormDialog>
          </div>
          <Select value={selectedSeason} onValueChange={(v) => setSelectedSeason(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Sem temporada">
                {selectedSeason
                  ? seasons.find((s) => String(s.id) === selectedSeason)?.name
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem temporada</SelectItem>
              {(seasons ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Data e hora</Label>
          <DateTimePicker value={dateTime} onChange={setDateTime} />
        </div>
      </section>

      {/* Fichas */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Fichas
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="initialChips">Fichas iniciais</Label>
            <Input
              id="initialChips"
              name="initialChips"
              type="number"
              min="1"
              value={initialChips}
              onChange={(e) => setInitialChips(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rebuyChips">Fichas de rebuy</Label>
            <Input
              id="rebuyChips"
              name="rebuyChips"
              type="number"
              min="0"
              value={rebuyChips}
              onChange={(e) => setRebuyChips(e.target.value)}
            />
          </div>
          {allowAddon && (
            <div className="space-y-2">
              <Label htmlFor="addonChips">Fichas de add-on</Label>
              <Input
                id="addonChips"
                name="addonChips"
                type="number"
                min="0"
                value={addonChips}
                onChange={(e) => setAddonChips(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxRebuys">Max rebuys</Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                />
                Ilimitado
              </label>
            </div>
            <Input
              id="maxRebuys"
              name="maxRebuys"
              type="number"
              min="1"
              value={maxRebuys}
              onChange={(e) => setMaxRebuys(e.target.value)}
              disabled={unlimited}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="allowAddon"
            checked={allowAddon}
            onCheckedChange={setAllowAddon}
          />
          <Label htmlFor="allowAddon">Permitir add-on</Label>
        </div>
      </section>

      {/* Valores */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Valores
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="buyInAmount">Buy-in (R$)</Label>
            <Input
              id="buyInAmount"
              name="buyInAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rebuyAmount">Rebuy (R$)</Label>
            <Input
              id="rebuyAmount"
              name="rebuyAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(e.target.value)}
            />
          </div>
          {allowAddon && (
            <div className="space-y-2">
              <Label htmlFor="addonAmount">Add-on (R$)</Label>
              <Input
                id="addonAmount"
                name="addonAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={addonAmount}
                onChange={(e) => setAddonAmount(e.target.value)}
              />
            </div>
          )}
        </div>
      </section>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? "Salvando..."
          : initialData
          ? "Salvar alteracoes"
          : "Criar torneio"}
      </Button>
    </form>
  );
}

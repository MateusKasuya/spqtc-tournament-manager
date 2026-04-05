"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Season {
  id: number;
  name: string;
}

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: number;
}

export function SeasonSelector({ seasons, selectedSeasonId }: SeasonSelectorProps) {
  const router = useRouter();

  return (
    <Select
      value={String(selectedSeasonId)}
      onValueChange={(value) => router.push(`/ranking?season=${value}`)}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Selecionar temporada" />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((season) => (
          <SelectItem key={season.id} value={String(season.id)}>
            {season.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

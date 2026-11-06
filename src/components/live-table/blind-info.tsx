import { formatChips } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { MesaLevel } from "@/db/queries/mesa";

interface BlindInfoProps {
  currentLevel: MesaLevel;
  nextLevel: MesaLevel | null;
  breakActive?: boolean;
}

// Mora dentro do botão que abre o painel Nível: só elementos de frase (span).
export function BlindInfo({ currentLevel, nextLevel, breakActive }: BlindInfoProps) {
  if (breakActive || currentLevel.isBreak) {
    const resumeLevel = breakActive ? currentLevel : nextLevel;
    return (
      <span className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-md bg-amber-100 px-4 py-1.5 text-xl font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          INTERVALO
        </span>
        {resumeLevel && !resumeLevel.isBreak && (
          <span className="block text-sm text-muted-foreground">
            Retorna: SB {formatChips(resumeLevel.smallBlind)} / BB {formatChips(resumeLevel.bigBlind)}
            {resumeLevel.ante > 0 && ` / Ante ${formatChips(resumeLevel.ante)}`}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-center gap-1 text-center">
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Nivel {currentLevel.level}
        </span>
        {currentLevel.isAddonLevel && (
          <Badge variant="outline" className="text-sm border-amber-400 text-amber-600 dark:text-amber-400">
            Add-on disponivel
          </Badge>
        )}
      </span>

      <span className="flex items-center gap-3 text-3xl font-bold tabular-nums">
        <span>{formatChips(currentLevel.smallBlind)}</span>
        <span className="text-muted-foreground text-xl">/</span>
        <span>{formatChips(currentLevel.bigBlind)}</span>
        {currentLevel.ante > 0 && (
          <>
            <span className="text-muted-foreground text-xl">/</span>
            <span className="text-xl">{formatChips(currentLevel.ante)}</span>
          </>
        )}
      </span>

      <span className="block text-sm text-muted-foreground">
        {currentLevel.isBigAnte ? "SB / BB / Big Ante" : currentLevel.ante > 0 ? "SB / BB / Ante" : "Small Blind / Big Blind"}
      </span>

      {nextLevel ? (
        <span className="block text-sm text-muted-foreground mt-1">
          {nextLevel.isBreak
            ? `Proximo: Intervalo (${nextLevel.durationMinutes}min)`
            : `Proximo: ${formatChips(nextLevel.smallBlind)} / ${formatChips(nextLevel.bigBlind)}${nextLevel.ante > 0 ? ` / ${formatChips(nextLevel.ante)}` : ""}`}
        </span>
      ) : (
        <span className="block text-sm text-muted-foreground mt-1">Ultimo nivel</span>
      )}
    </span>
  );
}

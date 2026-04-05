import { formatChips } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

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

interface BlindInfoProps {
  currentLevel: BlindLevel;
  nextLevel: BlindLevel | null;
  breakActive?: boolean;
}

export function BlindInfo({ currentLevel, nextLevel, breakActive }: BlindInfoProps) {
  if (breakActive || currentLevel.isBreak) {
    const resumeLevel = breakActive ? currentLevel : nextLevel;
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-md bg-amber-100 px-4 py-1.5 text-lg font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          INTERVALO
        </span>
        {resumeLevel && !resumeLevel.isBreak && (
          <p className="text-xs text-muted-foreground">
            Retorna: SB {formatChips(resumeLevel.smallBlind)} / BB {formatChips(resumeLevel.bigBlind)}
            {resumeLevel.ante > 0 && ` / Ante ${formatChips(resumeLevel.ante)}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Nivel {currentLevel.level}
        </span>
        {currentLevel.isAddonLevel && (
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">
            Add-on disponivel
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3 text-2xl font-bold tabular-nums">
        <span>{formatChips(currentLevel.smallBlind)}</span>
        <span className="text-muted-foreground text-lg">/</span>
        <span>{formatChips(currentLevel.bigBlind)}</span>
        {currentLevel.ante > 0 && (
          <>
            <span className="text-muted-foreground text-lg">/</span>
            <span className="text-lg">{formatChips(currentLevel.ante)}</span>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {currentLevel.isBigAnte ? "SB / BB / Big Ante" : currentLevel.ante > 0 ? "SB / BB / Ante" : "Small Blind / Big Blind"}
      </p>

      {nextLevel ? (
        <p className="text-xs text-muted-foreground mt-1">
          {nextLevel.isBreak
            ? `Proximo: Intervalo (${nextLevel.durationMinutes}min)`
            : `Proximo: ${formatChips(nextLevel.smallBlind)} / ${formatChips(nextLevel.bigBlind)}${nextLevel.ante > 0 ? ` / ${formatChips(nextLevel.ante)}` : ""}`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">Ultimo nivel</p>
      )}
    </div>
  );
}

import { formatChips, formatTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { BlindStructurePanel, BlindStructureRow } from "@/lib/mesa-panels";

// Tempo até o Intervalo: mm:ss como o Relógio e, a partir de 1 hora, h:mm:ss.
function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  if (hours === 0) return formatTime(totalSeconds);
  return `${hours}:${formatTime(totalSeconds % 3600)}`;
}

function blinds(row: BlindStructureRow): string {
  const base = `${formatChips(row.smallBlind)} / ${formatChips(row.bigBlind)}`;
  if (row.ante <= 0) return base;
  return `${base} / ${formatChips(row.ante)}${row.isBigAnte ? " BBA" : ""}`;
}

// Painel Nível: a estrutura de blinds com o Nível atual marcado e o tempo até o
// próximo Intervalo da estrutura. Recebe o modelo da derivação e só desenha.
export function LevelPanel({ panel }: { panel: BlindStructurePanel }) {
  return (
    <div className="flex flex-col gap-4">
      {panel.secondsToNextBreak !== null && (
        <p className="text-sm">
          Proximo intervalo em{" "}
          <span className="font-semibold tabular-nums">{formatCountdown(panel.secondsToNextBreak)}</span>
        </p>
      )}
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th scope="col" className="py-2 pr-3 text-left font-medium">Nivel</th>
            <th scope="col" className="py-2 pr-3 text-left font-medium">SB / BB / Ante</th>
            <th scope="col" className="py-2 text-right font-medium">Duracao</th>
          </tr>
        </thead>
        <tbody>
          {panel.levels.map((row) => (
            <tr
              key={row.level}
              aria-current={row.isCurrent ? "step" : undefined}
              className={`border-b ${row.isCurrent ? "bg-accent font-semibold" : ""} ${row.isBreak ? "text-amber-700 dark:text-amber-400" : ""}`}
            >
              <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">
                {row.level}
                {row.isCurrent && <span className="sr-only"> (nivel atual)</span>}
              </th>
              <td className="py-2 pr-3">
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.isBreak ? "Intervalo" : blinds(row)}
                  {row.isCurrent && (
                    <Badge variant="outline" className="text-xs" aria-hidden>
                      Atual
                    </Badge>
                  )}
                  {row.isAddonLevel && (
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">
                      Add-on
                    </Badge>
                  )}
                </span>
              </td>
              <td className="py-2 text-right whitespace-nowrap">{row.durationMinutes}min</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

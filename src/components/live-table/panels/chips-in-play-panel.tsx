import { formatChips } from "@/lib/format";
import type { ChipSource, ChipsInPlayPanel as ChipsInPlayPanelModel } from "@/lib/mesa-panels";

const SOURCE_LABEL: Record<ChipSource, string> = {
  buyIn: "Buy-ins",
  rebuy: "Rebuys",
  addon: "Add-ons",
  bonus: "Bonus",
};

export function ChipsInPlayPanel({ panel }: { panel: ChipsInPlayPanelModel }) {
  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm tabular-nums">
        <tbody>
          {panel.lines.map((line) => (
            <tr key={line.source} className="border-b">
              <th scope="row" className="py-2 pr-3 text-left font-medium">{SOURCE_LABEL[line.source]}</th>
              <td className="py-2 pr-3 text-right text-muted-foreground whitespace-nowrap">
                {line.count} × {formatChips(line.chipsEach)}
              </td>
              <td className="py-2 text-right whitespace-nowrap">{formatChips(line.chips)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2} className="pt-2 pr-3 text-left font-semibold">Fichas em jogo</th>
            <td className="pt-2 text-right font-semibold whitespace-nowrap">{formatChips(panel.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-sm text-muted-foreground">
        Nenhuma ficha sai do jogo; as fichas de quem caiu continuam na mesa.
      </p>
    </div>
  );
}

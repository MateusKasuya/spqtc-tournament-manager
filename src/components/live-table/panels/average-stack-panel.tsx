import { formatChips } from "@/lib/format";
import {
  formatAverageInBigBlinds,
  formatAverageStack,
  type AverageStackPanel as AverageStackPanelModel,
} from "@/lib/mesa-panels";

// Painel Stack médio: o número em fichas e em big blinds, a conta que dá o número
// e os big blinds no próximo Nível. Recebe o modelo da derivação e só desenha.
export function AverageStackPanel({ panel }: { panel: AverageStackPanelModel }) {
  const average = formatAverageStack(panel.average);
  return (
    <div className="flex flex-col gap-4">
      {panel.average === null ? (
        <p className="text-2xl font-bold">{average}</p>
      ) : (
        <p className="text-2xl font-bold tabular-nums">
          {average} fichas{" "}
          <span className="text-lg font-semibold text-muted-foreground">
            {formatAverageInBigBlinds(panel.average, panel.bigBlind)}
          </span>
        </p>
      )}
      <table className="w-full text-sm tabular-nums">
        <tbody>
          <tr className="border-b">
            <th scope="row" className="py-2 pr-3 text-left font-medium">Fichas em jogo</th>
            <td className="py-2 text-right whitespace-nowrap">{formatChips(panel.chipsInPlay)}</td>
          </tr>
          <tr className="border-b">
            <th scope="row" className="py-2 pr-3 text-left font-medium">÷ Em jogo</th>
            <td className="py-2 text-right whitespace-nowrap">{panel.playingCount}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="pt-2 pr-3 text-left font-semibold">Stack medio</th>
            <td className="pt-2 text-right font-semibold whitespace-nowrap">{average}</td>
          </tr>
          {panel.nextLevel && (
            <tr>
              <th scope="row" className="pt-2 pr-3 text-left font-medium text-muted-foreground">
                No Nivel {panel.nextLevel.level}
              </th>
              <td className="pt-2 text-right text-muted-foreground whitespace-nowrap">
                {formatAverageInBigBlinds(panel.average, panel.nextLevel.bigBlind)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
      <p className="text-sm text-muted-foreground">
        Valor medio: o stack de cada jogador nao fica registrado.
      </p>
    </div>
  );
}

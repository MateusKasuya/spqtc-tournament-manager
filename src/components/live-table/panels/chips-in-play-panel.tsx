import { formatChips, formatCurrency } from "@/lib/format";
import type {
  ChipSource,
  ChipsInPlayAllowedEntries,
  ChipsInPlayPanel as ChipsInPlayPanelModel,
} from "@/lib/mesa-panels";

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
      <AllowedEntries entries={panel.allowedEntries} />
    </div>
  );
}

// "Ainda da Rebuy?": as entradas que o torneio permite, com valor, fichas e limite.
function AllowedEntries({ entries }: { entries: ChipsInPlayAllowedEntries }) {
  const items: { label: string; text: string }[] = [];
  if (entries.rebuy) {
    const limit = entries.rebuy.maxPerPlayer === null ? "ilimitado" : `ate ${entries.rebuy.maxPerPlayer} por pessoa`;
    items.push({
      label: "Rebuy",
      text: `${formatCurrency(entries.rebuy.amount)} → ${formatChips(entries.rebuy.chips)} fichas, ${limit}`,
    });
  }
  if (entries.addon) {
    items.push({
      label: "Add-on",
      text: `${formatCurrency(entries.addon.amount)} → ${formatChips(entries.addon.chips)} fichas, sem limite por pessoa`,
    });
  }
  if (entries.bonus) {
    items.push({ label: "Bonus", text: `${formatChips(entries.bonus.chips)} fichas, uma vez por pessoa, sem custo` });
  }
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Regras de entrada</h3>
      <dl className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex gap-2">
            <dt className="font-medium">{item.label}</dt>
            <dd className="text-muted-foreground">{item.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

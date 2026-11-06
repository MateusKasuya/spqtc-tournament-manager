import { formatChips, formatCurrency } from "@/lib/format";
import type {
  ChipSource,
  ChipsInPlayEntryRules,
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
      <EntryRules rules={panel.entryRules} />
    </div>
  );
}

// "Ainda da Rebuy?": as entradas que o torneio permite, com valor, fichas e limite.
function EntryRules({ rules }: { rules: ChipsInPlayEntryRules }) {
  const items: { label: string; text: string }[] = [];
  if (rules.rebuy) {
    const limit = rules.rebuy.maxPerPlayer === null ? "ilimitado" : `ate ${rules.rebuy.maxPerPlayer} por pessoa`;
    items.push({
      label: "Rebuy",
      text: `${formatCurrency(rules.rebuy.amount)} → ${formatChips(rules.rebuy.chips)} fichas, ${limit}`,
    });
  }
  if (rules.addon) {
    items.push({
      label: "Add-on",
      text: `${formatCurrency(rules.addon.amount)} → ${formatChips(rules.addon.chips)} fichas`,
    });
  }
  if (rules.bonus) {
    items.push({ label: "Bonus", text: `${formatChips(rules.bonus.chips)} fichas, uma vez por pessoa, sem custo` });
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

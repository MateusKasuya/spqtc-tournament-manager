import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { BountyPanel as BountyPanelModel } from "@/lib/mesa-panels";

// Painel Bounty em jogo: o Bounty de cada Em jogo com o que rende derrubá-lo
// sozinho, o Bounty coletado de cada Participante e a conferência com o Bounty
// armado do Prize pool. Recebe o modelo da derivação e só desenha.
export function BountyPanel({ panel }: { panel: BountyPanelModel }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Bounty de cada jogador em jogo</h3>
        {panel.inPlay.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguem em jogo.</p>
        ) : (
          <ul className="flex flex-col">
            {panel.inPlay.map((e) => (
              <li key={e.participantId} className="flex flex-col gap-0.5 border-b py-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(e.bounty)}</span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  derrubar sozinho: {formatCurrency(e.soloKnockout.cash)} em dinheiro +{" "}
                  {formatCurrency(e.soloKnockout.bounty)} no seu Bounty
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Bounty coletado</h3>
        {panel.collected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguem coletou Bounty ainda.</p>
        ) : (
          <ul className="flex flex-col">
            {panel.collected.map((e) => (
              <li key={e.participantId} className="flex flex-col gap-0.5 border-b py-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="tabular-nums whitespace-nowrap">{formatCurrency(e.collected)}</span>
                </div>
                {e.champion && (
                  <p className="text-xs text-muted-foreground">
                    Campeao: inclui o proprio Bounty coletado na Coroacao
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Conferencia</h3>
        <table className="w-full text-sm tabular-nums">
          <tbody>
            <Row label="Bounty em jogo" amount={panel.bountyInPlay} />
            <Row label="Bounties coletados" amount={panel.collectedTotal} />
            <Row label="Bounty armado" amount={panel.allocated} total />
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          O Bounty armado e o mesmo que sai do Prize pool.
        </p>
      </section>
    </div>
  );
}

function Row({ label, amount, total = false }: { label: string; amount: number; total?: boolean }) {
  return (
    <tr className="border-b">
      <th scope="row" className={cn("py-2 pr-3 text-left", total ? "font-semibold" : "font-medium")}>
        {label}
      </th>
      <td className={cn("py-2 text-right whitespace-nowrap", total && "font-semibold")}>{formatCurrency(amount)}</td>
    </tr>
  );
}

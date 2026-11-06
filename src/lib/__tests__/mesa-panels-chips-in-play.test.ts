import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatChips } from "@/lib/format";
import { makeInput, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

// Fichas: iniciais 10.000, Rebuy 10.000, add-on 15.000, bônus 2.000.
const tournament = makeTournament({
  initialChips: 10000,
  rebuyChips: 10000,
  addonChips: 15000,
  bonusChipAmount: 2000,
});

function chipsInPlay(participants: ReturnType<typeof makeParticipant>[], t = tournament) {
  return buildMesaPanels(makeInput({ snapshot: makeSnapshot({ tournament: t, participants }) })).chipsInPlay;
}

describe("painel Fichas em jogo", () => {
  it("soma buy-ins, Rebuys, add-ons e bônus, contando o Rebuy duplo como 2", () => {
    const { panel } = chipsInPlay([
      makeParticipant({ rebuyCount: 2, addonCount: 1, bonusChipUsed: true }),
      makeParticipant({ rebuyCount: 1, addonCount: 1 }),
      makeParticipant({ status: "eliminated", bonusChipUsed: true }),
    ]);

    expect(panel.lines).toEqual([
      { source: "buyIn", count: 3, chipsEach: 10000, chips: 30000 },
      { source: "rebuy", count: 3, chipsEach: 10000, chips: 30000 },
      { source: "addon", count: 2, chipsEach: 15000, chips: 30000 },
      { source: "bonus", count: 2, chipsEach: 2000, chips: 4000 },
    ]);
    expect(panel.total).toBe(94000);
  });

  it("só conta buy-in confirmado; quem está Aguardando buy-in não entra", () => {
    const { panel } = chipsInPlay([
      makeParticipant(),
      makeParticipant({ status: "registered", buyInPaid: false }),
    ]);

    expect(panel.lines).toEqual([{ source: "buyIn", count: 1, chipsEach: 10000, chips: 10000 }]);
    expect(panel.total).toBe(10000);
  });

  it("esconde as linhas zeradas", () => {
    const { panel } = chipsInPlay([makeParticipant(), makeParticipant({ addonCount: 1 })]);

    expect(panel.lines.map((l) => l.source)).toEqual(["buyIn", "addon"]);
  });

  it("esconde a linha de bônus quando o torneio não dá fichas de bônus", () => {
    const { panel } = chipsInPlay(
      [makeParticipant({ bonusChipUsed: true })],
      makeTournament({ ...tournament, bonusChipAmount: 0 })
    );

    expect(panel.lines.map((l) => l.source)).toEqual(["buyIn"]);
    expect(panel.total).toBe(10000);
  });

  it("sem buy-in confirmado não há linhas e o total é zero", () => {
    const { panel, card } = chipsInPlay([makeParticipant({ status: "registered", buyInPaid: false })]);

    expect(panel.lines).toEqual([]);
    expect(panel.total).toBe(0);
    expect(card.value).toBe(formatChips(0));
  });

  it("a face do card mostra o mesmo total do painel", () => {
    const { panel, card } = chipsInPlay([
      makeParticipant({ rebuyCount: 2, addonCount: 1, bonusChipUsed: true }),
      makeParticipant(),
    ]);

    expect(card.label).toBe("Fichas em jogo");
    expect(card.value).toBe(formatChips(panel.total));
    expect(card.supportLines).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatChips } from "@/lib/format";
import { makeInput, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

const tournament = makeTournament({ initialChips: 10000, rebuyChips: 10000, addonChips: 15000, bonusChipAmount: 2000 });

function averageStack(participants: ReturnType<typeof makeParticipant>[]) {
  return buildMesaPanels(makeInput({ snapshot: makeSnapshot({ tournament, participants }) })).averageStack;
}

describe("card Stack médio", () => {
  it("divide as Fichas em jogo pelos Participantes em jogo, arredondando", () => {
    // 3 buy-ins + 1 add-on = 45.000 fichas para 2 Em jogo.
    const { card } = averageStack([
      makeParticipant({ addonCount: 1 }),
      makeParticipant(),
      makeParticipant({ status: "eliminated" }),
    ]);

    expect(card).toEqual({ label: "Stack medio", value: formatChips(22500), sub: null });
  });

  it("arredonda a média para o inteiro mais próximo", () => {
    // 4 buy-ins + 2 bônus = 44.000 fichas para 3 Em jogo ≈ 14.666,7.
    const { card } = averageStack([
      makeParticipant({ bonusChipUsed: true }),
      makeParticipant({ bonusChipUsed: true }),
      makeParticipant(),
      makeParticipant({ status: "eliminated" }),
    ]);

    expect(card.value).toBe(formatChips(14667));
  });

  it("sem ninguém Em jogo mostra zero, como hoje", () => {
    const { card } = averageStack([makeParticipant({ status: "registered", buyInPaid: false })]);

    expect(card.value).toBe(formatChips(0));
  });
});

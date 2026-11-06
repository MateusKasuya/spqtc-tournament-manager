import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { makeInput, makeParticipant, makeSnapshot } from "./mesa-panels-fixture";

describe("card Jogadores", () => {
  it("mostra quantos estão Em jogo e quantos têm buy-in confirmado", () => {
    const participants = [
      makeParticipant(),
      makeParticipant(),
      makeParticipant({ status: "eliminated", finishPosition: 3 }),
      makeParticipant({ status: "registered", buyInPaid: false }),
    ];
    const { card } = buildMesaPanels(makeInput({ snapshot: makeSnapshot({ participants }) })).players;

    expect(card).toEqual({ label: "Jogadores", value: "2", sub: "de 3 pagos" });
  });
});

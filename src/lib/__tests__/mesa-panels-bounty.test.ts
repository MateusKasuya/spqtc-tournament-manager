import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatCurrency } from "@/lib/format";
import { makeInput, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

describe("card Bounty", () => {
  it("em Bounty Builder soma os Bounties de quem está na mesa", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder" }),
      participants: [
        makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
        makeParticipant({ currentBounty: 2501 }),
        makeParticipant({ status: "eliminated", currentBounty: 0, bountiesCollected: 1000 }),
      ],
    });
    const { bounty } = buildMesaPanels(makeInput({ snapshot }));

    expect(bounty?.card).toEqual({ label: "Bounty pool", value: formatCurrency(8501), sub: "em jogo" });
  });

  it("em torneio normal não existe", () => {
    const snapshot = makeSnapshot({ tournament: makeTournament({ tournamentType: "normal" }) });

    expect(buildMesaPanels(makeInput({ snapshot })).bounty).toBeNull();
  });
});

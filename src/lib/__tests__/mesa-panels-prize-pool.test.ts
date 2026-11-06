import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatCurrency } from "@/lib/format";
import { makeInput, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

describe("card Prize pool", () => {
  it("mostra o Prize pool: Arrecadado menos o Fundo de ranking", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "normal", rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), makeParticipant(), makeParticipant({ status: "registered", buyInPaid: false })],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 5000, prize: 0, bounty_earned: 0 },
    });
    const { card } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(card).toEqual({ label: "Prize pool", value: formatCurrency(31000), supportLines: [] });
  });

  it("em Bounty Builder desconta também o Bounty armado", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder", rankingFeeAmount: 2000 }),
      participants: [
        makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
        makeParticipant({ status: "eliminated", currentBounty: 0 }),
      ],
      financialSummary: { buy_in: 20000, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { card } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(card.value).toBe(formatCurrency(20000 - 4000 - 10000));
  });
});

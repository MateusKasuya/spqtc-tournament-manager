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

describe("painel Prize pool", () => {
  it("em torneio normal mostra a conta do Arrecadado ao Prize pool, sem a linha do Bounty armado", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "normal", rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), makeParticipant(), makeParticipant({ status: "registered", buyInPaid: false })],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 5000, prize: 0, bounty_earned: 0 },
    });
    const { panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel).toEqual({
      buyIns: 20000,
      rebuys: 10000,
      addons: 5000,
      collected: 35000,
      rankingFund: 4000,
      bountyAllocated: null,
      prizePool: 31000,
      payout: null,
    });
  });

  it("em Bounty Builder a conta desconta também o Bounty armado, em jogo e coletado", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder", rankingFeeAmount: 2000 }),
      participants: [
        makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
        makeParticipant({ status: "eliminated", currentBounty: 0 }),
      ],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel).toMatchObject({
      collected: 30000,
      rankingFund: 4000,
      bountyAllocated: 10000,
      prizePool: 16000,
    });
  });

  it("em Bounty Builder a linha do Bounty armado aparece mesmo zerada", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder" }),
      participants: [makeParticipant({ status: "registered", buyInPaid: false })],
    });
    const { panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel.bountyAllocated).toBe(0);
  });

  it("sem Prêmios pagos não mostra Prêmios pagos nem Saldo", () => {
    const snapshot = makeSnapshot({
      participants: [makeParticipant()],
      financialSummary: { buy_in: 10000, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 },
    });
    const { panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel.payout).toBeNull();
  });

  it("com Prêmios pagos mostra o total pago e o Saldo", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ rankingFeeAmount: 2000 }),
      participants: [makeParticipant(), makeParticipant({ status: "finished", finishPosition: 1 })],
      financialSummary: { buy_in: 20000, rebuy: 10000, addon: 0, prize: 20000, bounty_earned: 0 },
    });
    const { panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel.prizePool).toBe(26000);
    expect(panel.payout).toEqual({ prizesPaid: 20000, saldo: 6000 });
  });

  it("mostra o Saldo como está, mesmo negativo", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ rankingFeeAmount: 0 }),
      participants: [makeParticipant()],
      financialSummary: { buy_in: 10000, rebuy: 0, addon: 0, prize: 15000, bounty_earned: 0 },
    });
    const { panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel.payout).toEqual({ prizesPaid: 15000, saldo: -5000 });
  });

  it("o Prize pool do painel é o mesmo da face do card", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "bounty_builder", rankingFeeAmount: 2000 }),
      participants: [makeParticipant({ currentBounty: 5000, bountiesCollected: 5000 }), makeParticipant({ currentBounty: 5000 })],
      financialSummary: { buy_in: 30000, rebuy: 10000, addon: 5000, prize: 1000, bounty_earned: 0 },
    });
    const { card, panel } = buildMesaPanels(makeInput({ snapshot })).prizePool;

    expect(panel.prizePool).toBe(45000 - 4000 - 15000);
    expect(card.value).toBe(formatCurrency(26000));
  });
});

import { describe, it, expect } from "vitest";
import { confirmBuyIn, eliminatePlayer, addRebuy } from "@/actions/participants";
import { getMesaLiveData } from "@/actions/mesa";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";

const BOUNTY_CONFIG = {
  tournamentType: "bounty_builder" as const,
  buyInAmount: 100,
  rebuyAmount: 60,
  rankingFeeAmount: 20,
  bountyPercentage: 50,
};

async function setupPlaying(t: number, n: number) {
  const players: number[] = [];
  const parts: number[] = [];
  for (let i = 0; i < n; i++) {
    const pl = await seedPlayer(`P${i}`);
    const p = await seedParticipant(t, pl);
    await confirmBuyIn(p);
    players.push(pl);
    parts.push(p);
  }
  return { players, parts };
}

describe("getMesaLiveData", () => {
  it("devolve participantes e resumo financeiro com Bounty coletado", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    await setupPlaying(t, 2);

    const res = await getMesaLiveData(t);

    expect(res.participants).toHaveLength(2);
    expect(res.financialSummary).toEqual({ buy_in: 200, rebuy: 0, addon: 0, prize: 0, bounty_earned: 0 });
  });

  it("participantes trazem so os campos da projecao da mesa", async () => {
    const t = await seedTournament();
    await setupPlaying(t, 1);

    const { participants } = await getMesaLiveData(t);

    expect(Object.keys(participants[0]).sort()).toEqual(
      [
        "id",
        "playerId",
        "name",
        "nickname",
        "status",
        "finishPosition",
        "buyInPaid",
        "rebuyCount",
        "addonCount",
        "bonusChipUsed",
        "currentBounty",
        "bountiesCollected",
      ].sort()
    );
  });

  it("reflete um Knockout feito por eliminatePlayer", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupPlaying(t, 3);
    await eliminatePlayer(parts[0], [players[1]]);

    const { participants, financialSummary } = await getMesaLiveData(t);

    const victim = participants.find((p) => p.id === parts[0]);
    const eliminator = participants.find((p) => p.id === parts[1]);
    expect(victim).toMatchObject({ status: "eliminated", currentBounty: 0, finishPosition: 3 });
    expect(eliminator).toMatchObject({ currentBounty: 60, bountiesCollected: 20 });
    expect(financialSummary.bounty_earned).toBe(20);
  });

  it("reflete um Rebuy feito por addRebuy", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupPlaying(t, 3);
    await addRebuy(parts[0], [players[1]]);

    const { participants, financialSummary } = await getMesaLiveData(t);

    const rebought = participants.find((p) => p.id === parts[0]);
    expect(rebought).toMatchObject({ status: "playing", rebuyCount: 1, currentBounty: 30 });
    expect(financialSummary.rebuy).toBe(60);
  });
});

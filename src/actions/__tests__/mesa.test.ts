import { describe, it, expect } from "vitest";
import { confirmBuyIn, eliminatePlayer, addRebuy, distributePayouts } from "@/actions/participants";
import { updateBlindStructure, updatePrizeStructure } from "@/actions/tournaments";
import { getMesaLiveData } from "@/actions/mesa";
import { seedTournament, seedPlayer, seedParticipant, makeLevels } from "@/test/setup";

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
    expect(await confirmBuyIn(p)).not.toHaveProperty("error");
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
    expect(await eliminatePlayer(parts[0], [players[1]])).not.toHaveProperty("error");

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
    expect(await addRebuy(parts[0], [players[1]])).not.toHaveProperty("error");

    const { participants, financialSummary } = await getMesaLiveData(t);

    const rebought = participants.find((p) => p.id === parts[0]);
    expect(rebought).toMatchObject({ status: "playing", rebuyCount: 1, currentBounty: 30 });
    expect(financialSummary.rebuy).toBe(60);
  });

  it("depois de editar a estrutura de blinds, a proxima chamada traz os Niveis novos", async () => {
    const t = await seedTournament({ status: "running", currentBlindLevel: 1 });
    expect(await updateBlindStructure(t, makeLevels(2))).not.toHaveProperty("error");
    expect((await getMesaLiveData(t)).blindLevels.map((l) => l.smallBlind)).toEqual([10, 20]);

    const edited = makeLevels(3).map((l) => ({ ...l, smallBlind: l.smallBlind * 5, bigBlind: l.bigBlind * 5, ante: 5 }));
    expect(await updateBlindStructure(t, edited)).not.toHaveProperty("error");

    const { blindLevels } = await getMesaLiveData(t);
    expect(blindLevels.map((l) => l.smallBlind)).toEqual([50, 100, 150]);
    expect(blindLevels[0]).toEqual({
      level: 1,
      smallBlind: 50,
      bigBlind: 100,
      ante: 5,
      durationMinutes: 15,
      isBreak: false,
      isAddonLevel: false,
      isBigAnte: false,
    });
  });

  it("devolve a Estrutura de premios com percentuais numericos em ordem de posicao", async () => {
    const t = await seedTournament();
    expect(
      await updatePrizeStructure(t, [
        { position: 3, percentage: 12.5 },
        { position: 1, percentage: 60 },
        { position: 2, percentage: 27.5 },
      ])
    ).not.toHaveProperty("error");

    const { prizeStructure } = await getMesaLiveData(t);

    expect(prizeStructure).toEqual([
      { position: 1, percentage: 60 },
      { position: 2, percentage: 27.5 },
      { position: 3, percentage: 12.5 },
    ]);
  });

  it("depois de editar a Estrutura de premios, a proxima chamada traz a Estrutura nova", async () => {
    const t = await seedTournament();
    expect(
      await updatePrizeStructure(t, [
        { position: 1, percentage: 70 },
        { position: 2, percentage: 30 },
      ])
    ).not.toHaveProperty("error");
    expect((await getMesaLiveData(t)).prizeStructure).toHaveLength(2);

    expect(
      await updatePrizeStructure(t, [
        { position: 1, percentage: 50 },
        { position: 2, percentage: 30 },
        { position: 3, percentage: 20 },
      ])
    ).not.toHaveProperty("error");

    const { prizeStructure } = await getMesaLiveData(t);
    expect(prizeStructure).toEqual([
      { position: 1, percentage: 50 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 20 },
    ]);
  });

  it("devolve os Premios pagos por Participante depois de Distribuir premios", async () => {
    const t = await seedTournament({ buyInAmount: 100 });
    const { players, parts } = await setupPlaying(t, 3);
    expect(
      await distributePayouts(t, [
        { playerId: players[2], amount: 180, position: 1 },
        { playerId: players[0], amount: 120, position: 2 },
      ])
    ).not.toHaveProperty("error");

    const { paidPrizesByParticipant } = await getMesaLiveData(t);

    expect(paidPrizesByParticipant).toEqual(
      expect.arrayContaining([
        { participantId: parts[2], amount: 180 },
        { participantId: parts[0], amount: 120 },
      ])
    );
    expect(paidPrizesByParticipant).toHaveLength(2);
  });

  it("depois de uma redistribuicao que tira alguem da lista, o Premio dessa pessoa nao aparece mais", async () => {
    const t = await seedTournament({ buyInAmount: 100 });
    const { players, parts } = await setupPlaying(t, 3);
    expect(
      await distributePayouts(t, [
        { playerId: players[0], amount: 200, position: 1 },
        { playerId: players[1], amount: 100, position: 2 },
      ])
    ).not.toHaveProperty("error");

    expect(await distributePayouts(t, [{ playerId: players[0], amount: 300, position: 1 }])).not.toHaveProperty(
      "error"
    );

    const { paidPrizesByParticipant } = await getMesaLiveData(t);
    expect(paidPrizesByParticipant).toEqual([{ participantId: parts[0], amount: 300 }]);
  });

  it("sem distribuicao nao ha Premios pagos", async () => {
    const t = await seedTournament();
    await setupPlaying(t, 2);

    expect((await getMesaLiveData(t)).paidPrizesByParticipant).toEqual([]);
  });

  it("sem Estrutura de premios devolve a Estrutura vazia", async () => {
    const t = await seedTournament();

    expect((await getMesaLiveData(t)).prizeStructure).toEqual([]);
  });
});

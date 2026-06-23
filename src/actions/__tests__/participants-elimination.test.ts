import { describe, it, expect } from "vitest";
import { eliminatePlayer, undoElimination } from "@/actions/participants";
import { getParticipantById } from "@/db/queries/participants";
import { getTournamentById } from "@/db/queries/tournaments";
import {
  seedTournament,
  seedPlayer,
  seedParticipant,
  seedPlayingParticipants,
} from "@/test/setup";

describe("eliminatePlayer / undoElimination", () => {
  it("eliminatePlayer em participante não-playing retorna error", async () => {
    const t = await seedTournament();
    const part = await seedParticipant(t, await seedPlayer()); // default: registered
    expect(await eliminatePlayer(part)).toHaveProperty("error");
  });

  it("atribui finishPosition decrescente e coroa o último como campeão", async () => {
    const t = await seedTournament();
    const [p0, p1, p2, p3] = await seedPlayingParticipants(t, 4);
    await eliminatePlayer(p0);
    await eliminatePlayer(p1);
    await eliminatePlayer(p2);
    expect((await getParticipantById(p0))?.finishPosition).toBe(4);
    expect((await getParticipantById(p1))?.finishPosition).toBe(3);
    expect((await getParticipantById(p2))?.finishPosition).toBe(2);
    const champ = await getParticipantById(p3);
    expect(champ?.status).toBe("finished");
    expect(champ?.finishPosition).toBe(1);
  });

  it("campeão automático com 2 jogadores", async () => {
    const t = await seedTournament();
    const [p0, p1] = await seedPlayingParticipants(t, 2);
    await eliminatePlayer(p0);
    expect((await getParticipantById(p0))?.finishPosition).toBe(2);
    const champ = await getParticipantById(p1);
    expect(champ?.status).toBe("finished");
    expect(champ?.finishPosition).toBe(1);
  });

  it("pausa o timer ao encerrar o torneio", async () => {
    const t = await seedTournament({ timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 600 });
    const [p0] = await seedPlayingParticipants(t, 2);
    await eliminatePlayer(p0);
    const tour = await getTournamentById(t);
    expect(tour?.timerRunning).toBe(false);
    expect(tour?.timerStartedAt).toBeNull();
    expect(typeof tour?.timerRemainingSecs).toBe("number");
    expect(tour?.timerRemainingSecs).toBeGreaterThanOrEqual(0);
  });

  it("undoElimination volta o jogador para playing", async () => {
    const t = await seedTournament();
    const [p0] = await seedPlayingParticipants(t, 3);
    await eliminatePlayer(p0);
    expect(await undoElimination(p0)).not.toHaveProperty("error");
    const p = await getParticipantById(p0);
    expect(p?.status).toBe("playing");
    expect(p?.finishPosition).toBeNull();
    expect(p?.eliminatedAt).toBeNull();
  });

  it("undoElimination da eliminação final descoroa o campeão", async () => {
    const t = await seedTournament();
    const [p0, p1] = await seedPlayingParticipants(t, 2);
    await eliminatePlayer(p0);
    expect((await getParticipantById(p1))?.status).toBe("finished");
    await undoElimination(p0);
    expect((await getParticipantById(p0))?.status).toBe("playing");
    const p1after = await getParticipantById(p1);
    expect(p1after?.status).toBe("playing");
    expect(p1after?.finishPosition).toBeNull();
  });

  it("undoElimination em jogador playing retorna error", async () => {
    const t = await seedTournament();
    const [p0] = await seedPlayingParticipants(t, 2);
    expect(await undoElimination(p0)).toHaveProperty("error");
  });
});

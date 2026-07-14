import { describe, it, expect } from "vitest";
import { confirmBuyIn, eliminatePlayer, addRebuy } from "@/actions/participants";
import { updateTournamentStatus } from "@/actions/tournaments";
import { getParticipantById } from "@/db/queries/participants";
import {
  seedTournament,
  seedPlayer,
  seedParticipant,
  seedPlayingParticipants,
} from "@/test/setup";

const BOUNTY_CONFIG = {
  tournamentType: "bounty_builder" as const,
  buyInAmount: 100,
  rankingFeeAmount: 20,
  bountyPercentage: 50,
};

// Semeia N jogadores em torneio bounty; cada um recebe currentBounty = 40 no buy-in.
async function setupBounty(t: number, n: number) {
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

const pts = async (participantId: number) =>
  Number((await getParticipantById(participantId))?.pointsEarned);

describe("pontos de eliminação (bounty)", () => {
  it("1. +0.25 por KO e exclui a auto-coleta do campeão", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await eliminatePlayer(parts[0], [players[1]]); // j1 elimina p0 (3º)
    await eliminatePlayer(parts[1], [players[2]]); // j2 elimina p1 (2º); p2 vira campeão
    await updateTournamentStatus(t, "finished");

    expect(await pts(parts[2])).toBe(12.25); // campeão pos1 + 1 KO (auto-coleta NÃO conta)
    expect(await pts(parts[1])).toBe(10.25); // pos2 + 1 KO
    expect(await pts(parts[0])).toBe(8); // pos3 + 0 KO
  });

  it("2. KO de rebuy conta (mesma vítima estourada 2×)", async () => {
    const t = await seedTournament({ ...BOUNTY_CONFIG, rebuyAmount: 60 });
    const { players, parts } = await setupBounty(t, 3);
    await addRebuy(parts[0], [players[1]]); // j1 derruba p0, mas p0 faz rebuy (segue jogando)
    await eliminatePlayer(parts[0], [players[1]]); // j1 elimina p0 de vez (3º)
    await eliminatePlayer(parts[1], [players[2]]); // j2 elimina p1 (2º); p2 campeão
    await updateTournamentStatus(t, "finished");

    expect(await pts(parts[1])).toBe(10.5); // pos2 + 2 KOs (0.50)
    expect(await pts(parts[2])).toBe(12.25); // campeão pos1 + 1 KO
    expect(await pts(parts[0])).toBe(8); // pos3 + 0 KO
  });

  it("3. eliminação dividida dá 0.25 a cada eliminador", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 4);
    await eliminatePlayer(parts[0], [players[1], players[2]]); // j1 e j2 dividem o KO de p0 (4º)
    await eliminatePlayer(parts[1], [players[3]]); // j3 elimina p1 (3º)
    await eliminatePlayer(parts[2], [players[3]]); // j3 elimina p2 (2º); p3 campeão
    await updateTournamentStatus(t, "finished");

    expect(await pts(parts[1])).toBe(8.25); // pos3 + 1 KO (split)
    expect(await pts(parts[2])).toBe(10.25); // pos2 + 1 KO (split)
    expect(await pts(parts[3])).toBe(12.5); // campeão pos1 + 2 KOs
  });

  it("4. torneio normal não aplica bônus de eliminação", async () => {
    const t = await seedTournament(); // tournamentType padrão = "normal"
    const parts = await seedPlayingParticipants(t, 3);
    await eliminatePlayer(parts[0]); // normal: sem eliminadores
    await eliminatePlayer(parts[1]); // p2 campeão
    await updateTournamentStatus(t, "finished");

    expect(await pts(parts[2])).toBe(12); // pos1, sem bônus
    expect(await pts(parts[1])).toBe(10); // pos2
    expect(await pts(parts[0])).toBe(8); // pos3
  });
});

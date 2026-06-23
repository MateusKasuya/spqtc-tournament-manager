import { describe, it, expect } from "vitest";
import {
  confirmBuyIn,
  eliminatePlayer,
  undoElimination,
  addRebuy,
  undoRebuy,
} from "@/actions/participants";
import { getParticipantById } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";

const BOUNTY_CONFIG = {
  tournamentType: "bounty_builder" as const,
  buyInAmount: 100,
  rankingFeeAmount: 20,
  bountyPercentage: 50,
};

async function setupBounty(t: number, n: number) {
  const players: number[] = [];
  const parts: number[] = [];
  for (let i = 0; i < n; i++) {
    const pl = await seedPlayer(`P${i}`);
    const p = await seedParticipant(t, pl);
    await confirmBuyIn(p); // status playing, currentBounty = 40
    players.push(pl);
    parts.push(p);
  }
  return { players, parts };
}

describe("bounty", () => {
  it("1. confirmBuyIn define bounty inicial 40", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { parts } = await setupBounty(t, 1);
    expect((await getParticipantById(parts[0]))?.currentBounty).toBe(40);
  });

  it("2. distribuição, 1 eliminador (3 jogadores)", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await eliminatePlayer(parts[0], [players[1]]);

    expect((await getParticipantById(parts[0]))?.currentBounty).toBe(0);
    const p1 = await getParticipantById(parts[1]);
    expect(p1?.currentBounty).toBe(60); // 40 + 20 (acúmulo)
    expect(p1?.bountiesCollected).toBe(20); // pagamento
  });

  it("3. distribuição, 2 eliminadores (4 jogadores)", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 4);
    await eliminatePlayer(parts[0], [players[1], players[2]]);

    const p1 = await getParticipantById(parts[1]);
    expect(p1?.currentBounty).toBe(50); // 40 + 10
    expect(p1?.bountiesCollected).toBe(10);
    const p2 = await getParticipantById(parts[2]);
    expect(p2?.currentBounty).toBe(50);
    expect(p2?.bountiesCollected).toBe(10);
  });

  it("4. eliminatePlayer bounty sem eliminadores → error", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { parts } = await setupBounty(t, 3);
    expect(await eliminatePlayer(parts[0])).toHaveProperty("error");
  });

  it("5. rebuy em bounty (rebuyAmount:60 → novo bounty 30)", async () => {
    const t = await seedTournament({ ...BOUNTY_CONFIG, rebuyAmount: 60 });
    const { players, parts } = await setupBounty(t, 3);
    await addRebuy(parts[0], [players[1]]);

    const p0 = await getParticipantById(parts[0]);
    expect(p0?.rebuyCount).toBe(1);
    expect(p0?.currentBounty).toBe(30); // novo bounty
    const p1 = await getParticipantById(parts[1]);
    expect(p1?.currentBounty).toBe(60); // 40 + 20 do bounty 40 de p0
    expect(p1?.bountiesCollected).toBe(20);

    // addRebuy sem eliminadores (outro torneio bounty) → error
    const t2 = await seedTournament({ ...BOUNTY_CONFIG, rebuyAmount: 60 });
    const { parts: parts2 } = await setupBounty(t2, 3);
    expect(await addRebuy(parts2[0])).toHaveProperty("error");
  });

  it("6. undoRebuy em bounty restaura", async () => {
    const t = await seedTournament({ ...BOUNTY_CONFIG, rebuyAmount: 60 });
    const { players, parts } = await setupBounty(t, 3);
    await addRebuy(parts[0], [players[1]]);
    await undoRebuy(parts[0]);

    const p0 = await getParticipantById(parts[0]);
    expect(p0?.rebuyCount).toBe(0);
    expect(p0?.currentBounty).toBe(40);
    const p1 = await getParticipantById(parts[1]);
    expect(p1?.currentBounty).toBe(40);
    expect(p1?.bountiesCollected).toBe(0);
  });

  it("7. undoElimination sem campeão (3 jogadores) restaura", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3);
    await eliminatePlayer(parts[0], [players[1]]); // 2 sobram, sem campeão
    await undoElimination(parts[0]);

    const p0 = await getParticipantById(parts[0]);
    expect(p0?.status).toBe("playing");
    expect(p0?.currentBounty).toBe(40);
    const p1 = await getParticipantById(parts[1]);
    expect(p1?.currentBounty).toBe(40);
    expect(p1?.bountiesCollected).toBe(0);
  });

  it("8. conservação fim-a-fim (3 jogadores)", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 3); // total criado = 120
    await eliminatePlayer(parts[0], [players[1]]);
    await eliminatePlayer(parts[1], [players[2]]); // p2 vira campeão

    const p0 = await getParticipantById(parts[0]);
    const p1 = await getParticipantById(parts[1]);
    const p2 = await getParticipantById(parts[2]);
    const total =
      (p0?.bountiesCollected ?? 0) +
      (p1?.bountiesCollected ?? 0) +
      (p2?.bountiesCollected ?? 0);
    expect(total).toBe(120);
    expect(p2?.status).toBe("finished");
    expect(p2?.finishPosition).toBe(1);
  });

  it("9. [regressão] eliminar até campeão e desfazer (2 jogadores)", async () => {
    const t = await seedTournament(BOUNTY_CONFIG);
    const { players, parts } = await setupBounty(t, 2);
    await eliminatePlayer(parts[0], [players[1]]); // p1 vira campeão
    await undoElimination(parts[0]);

    const p0 = await getParticipantById(parts[0]);
    expect(p0?.status).toBe("playing");
    expect(p0?.currentBounty).toBe(40);
    const p1 = await getParticipantById(parts[1]);
    expect(p1?.status).toBe("playing");
    expect(p1?.finishPosition).toBeNull();
    expect(p1?.currentBounty).toBe(40);
    expect(p1?.bountiesCollected).toBe(0);
    expect((await getTournamentFinancialSummary(t)).bounty_earned).toBe(0);
  });

  it("10. [regressao] undoRebuy bloqueado apos eliminacao (nao varre bounty posterior)", async () => {
    const t = await seedTournament({ ...BOUNTY_CONFIG, rebuyAmount: 60 });
    const { players, parts } = await setupBounty(t, 3);

    await addRebuy(parts[0], [players[1]]); // P0 rebuy: P1 coleta 20; P0 bounty novo 30, playing
    await eliminatePlayer(parts[0], [players[2]]); // P0 eliminado por P2: P2 coleta 15

    // undoRebuy num jogador ja eliminado deve ser bloqueado (guard de status)
    const res = await undoRebuy(parts[0]);
    expect(res).toHaveProperty("error");

    // a eliminacao posterior (P2) NAO foi varrida pelo antigo gte
    const p0 = await getParticipantById(parts[0]);
    expect(p0?.status).toBe("eliminated");
    expect(p0?.rebuyCount).toBe(1);
    const p2 = await getParticipantById(parts[2]);
    expect(p2?.bountiesCollected).toBe(15);
    expect(p2?.currentBounty).toBe(55);
    // ledger intacto: 20 (rebuy) + 15 (eliminacao) = 35
    expect((await getTournamentFinancialSummary(t)).bounty_earned).toBe(35);
  });
});

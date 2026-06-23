import { describe, it, expect } from "vitest";
import {
  addParticipant,
  removeParticipant,
  confirmBuyIn,
  undoBuyIn,
  addRebuy,
  addDoubleRebuy,
  undoRebuy,
  addAddon,
  undoAddon,
  addBonusChip,
  undoBonusChip,
} from "@/actions/participants";
import { getParticipantById } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";

describe("registro", () => {
  it("addParticipant inscreve; 2a chamada com mesmo player retorna erro", async () => {
    const t = await seedTournament();
    const player = await seedPlayer();
    const res = await addParticipant(t, player);
    expect(res).not.toHaveProperty("error");
    const dup = await addParticipant(t, player);
    expect(dup).toHaveProperty("error");
  });

  it("addParticipant em torneio finished retorna erro", async () => {
    const t = await seedTournament({ status: "finished" });
    const player = await seedPlayer();
    const res = await addParticipant(t, player);
    expect(res).toHaveProperty("error");
  });

  it("removeParticipant remove um registered; apos confirmBuyIn, remover retorna erro", async () => {
    const t = await seedTournament();
    const part = await seedParticipant(t, await seedPlayer());
    const res = await removeParticipant(part);
    expect(res).not.toHaveProperty("error");
    expect(await getParticipantById(part)).toBeFalsy();

    const part2 = await seedParticipant(t, await seedPlayer("P2"));
    await confirmBuyIn(part2);
    const blocked = await removeParticipant(part2);
    expect(blocked).toHaveProperty("error");
  });
});

describe("buy-in", () => {
  it("confirmBuyIn marca playing e registra a transação (normal)", async () => {
    const t = await seedTournament({ buyInAmount: 100 });
    const part = await seedParticipant(t, await seedPlayer());
    const res = await confirmBuyIn(part);
    expect(res).not.toHaveProperty("error");
    const p = await getParticipantById(part);
    expect(p?.status).toBe("playing");
    expect(p?.buyInPaid).toBe(true);
    expect(p?.currentBounty).toBe(0);
    expect((await getTournamentFinancialSummary(t)).buy_in).toBe(100);
  });

  it("confirmBuyIn em bounty_builder calcula currentBounty", async () => {
    const t = await seedTournament({
      tournamentType: "bounty_builder",
      buyInAmount: 100,
      rankingFeeAmount: 20,
      bountyPercentage: 50,
    });
    const part = await seedParticipant(t, await seedPlayer());
    const res = await confirmBuyIn(part);
    expect(res).not.toHaveProperty("error");
    const p = await getParticipantById(part);
    // floor((100 - 20) * 50 / 100) === 40
    expect(p?.currentBounty).toBe(40);
  });

  it("undoBuyIn volta para registered e zera a transação", async () => {
    const t = await seedTournament({ buyInAmount: 100 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await undoBuyIn(part);
    expect(res).not.toHaveProperty("error");
    const p = await getParticipantById(part);
    expect(p?.status).toBe("registered");
    expect(p?.buyInPaid).toBe(false);
    expect((await getTournamentFinancialSummary(t)).buy_in).toBe(0);
  });

  it("undoBuyIn bloqueado quando ja houve rebuy", async () => {
    const t = await seedTournament({ buyInAmount: 100, rebuyAmount: 50 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    await addRebuy(part);
    const res = await undoBuyIn(part);
    expect(res).toHaveProperty("error");
  });
});

describe("rebuy", () => {
  it("addRebuy incrementa rebuyCount e soma no resumo", async () => {
    const t = await seedTournament({ rebuyAmount: 50 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addRebuy(part);
    expect(res).not.toHaveProperty("error");
    const p = await getParticipantById(part);
    expect(p?.rebuyCount).toBe(1);
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(50);
  });

  it("addRebuy bloqueado quando rebuyAmount é 0", async () => {
    const t = await seedTournament({ rebuyAmount: 0 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addRebuy(part);
    expect(res).toHaveProperty("error");
  });

  it("addRebuy respeita maxRebuys", async () => {
    const t = await seedTournament({ rebuyAmount: 50, maxRebuys: 1 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const first = await addRebuy(part);
    expect(first).not.toHaveProperty("error");
    const second = await addRebuy(part);
    expect(second).toHaveProperty("error");
  });

  it("addDoubleRebuy incrementa em 2 e soma 2x no resumo", async () => {
    const t = await seedTournament({ rebuyAmount: 50 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addDoubleRebuy(part);
    expect(res).not.toHaveProperty("error");
    const p = await getParticipantById(part);
    expect(p?.rebuyCount).toBe(2);
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(100);
  });

  it("addDoubleRebuy respeita maxRebuys", async () => {
    const t = await seedTournament({ rebuyAmount: 50, maxRebuys: 1 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addDoubleRebuy(part);
    expect(res).toHaveProperty("error");
  });

  it("undoRebuy reverte o contador e o resumo", async () => {
    const t = await seedTournament({ rebuyAmount: 50 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    await addRebuy(part);
    const res = await undoRebuy(part);
    expect(res).not.toHaveProperty("error");
    const p = await getParticipantById(part);
    expect(p?.rebuyCount).toBe(0);
    expect((await getTournamentFinancialSummary(t)).rebuy).toBe(0);
  });
});

describe("add-on / bonus", () => {
  it("addAddon bloqueado quando allowAddon é false", async () => {
    const t = await seedTournament({ allowAddon: false });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addAddon(part);
    expect(res).toHaveProperty("error");
  });

  it("addAddon incrementa e soma; undoAddon reverte", async () => {
    const t = await seedTournament({ allowAddon: true, addonAmount: 30 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addAddon(part);
    expect(res).not.toHaveProperty("error");
    let p = await getParticipantById(part);
    expect(p?.addonCount).toBe(1);
    expect((await getTournamentFinancialSummary(t)).addon).toBe(30);

    await undoAddon(part);
    p = await getParticipantById(part);
    expect(p?.addonCount).toBe(0);
  });

  it("addBonusChip marca bonusChipUsed; undoBonusChip reverte", async () => {
    const t = await seedTournament({ bonusChipAmount: 5000 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addBonusChip(part);
    expect(res).not.toHaveProperty("error");
    let p = await getParticipantById(part);
    expect(p?.bonusChipUsed).toBe(true);

    await undoBonusChip(part);
    p = await getParticipantById(part);
    expect(p?.bonusChipUsed).toBe(false);
  });

  it("addBonusChip bloqueado quando bonusChipAmount é 0", async () => {
    const t = await seedTournament({ bonusChipAmount: 0 });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    const res = await addBonusChip(part);
    expect(res).toHaveProperty("error");
  });
});

describe("resumo financeiro", () => {
  it("agrega buy-in, rebuys e add-on corretamente", async () => {
    const t = await seedTournament({
      buyInAmount: 100,
      rebuyAmount: 50,
      allowAddon: true,
      addonAmount: 30,
    });
    const part = await seedParticipant(t, await seedPlayer());
    await confirmBuyIn(part);
    await addRebuy(part);
    await addRebuy(part);
    await addAddon(part);
    expect(await getTournamentFinancialSummary(t)).toEqual({
      buy_in: 100,
      rebuy: 100,
      addon: 30,
      prize: 0,
      bounty_earned: 0,
    });
  });
});

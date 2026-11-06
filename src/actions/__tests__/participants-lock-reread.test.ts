import { describe, it, expect, vi, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { confirmBuyIn, addAddon, undoAddon } from "@/actions/participants";
import * as participantQueries from "@/db/queries/participants";
import * as tournamentQueries from "@/db/queries/tournaments";
import { testDb } from "@/test/db";
import { participants, tournaments, transactions } from "@/db/schema";
import { STATUS_RULES } from "@/lib/tournament-status";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";

// O pglite tem uma conexão só, então a race não se reproduz: simula-se a escrita
// concorrente fazendo a leitura de fora do lock devolver um estado desatualizado.
// A decisão tem de sair da releitura dentro do lock, ou seja, da linha do banco.

afterEach(() => {
  vi.restoreAllMocks();
});

async function participantRow(id: number) {
  const [row] = await testDb.select().from(participants).where(eq(participants.id, id));
  return row;
}

async function tournamentRow(id: number) {
  const [row] = await testDb.select().from(tournaments).where(eq(tournaments.id, id));
  return row;
}

async function playerTransactions(tournamentId: number, playerId: number, type: "buy_in" | "addon") {
  return testDb
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.tournamentId, tournamentId),
        eq(transactions.playerId, playerId),
        eq(transactions.type, type)
      )
    );
}

async function allTransactions(tournamentId: number) {
  return testDb.select().from(transactions).where(eq(transactions.tournamentId, tournamentId));
}

function staleTournament(row: typeof tournaments.$inferSelect, changes: Partial<typeof tournaments.$inferSelect>) {
  return vi
    .spyOn(tournamentQueries, "getTournamentRequiringStatus")
    .mockResolvedValueOnce({ tournament: { ...row, ...changes } });
}

function staleParticipant(row: typeof participants.$inferSelect, changes: Partial<typeof participants.$inferSelect>) {
  return vi.spyOn(participantQueries, "getParticipantById").mockResolvedValueOnce({ ...row, ...changes });
}

describe("confirmBuyIn relê torneio e participante dentro do lock", () => {
  it("currentBounty e amount saem do torneio no banco, não da leitura de fora", async () => {
    const t = await seedTournament({
      status: "pending",
      tournamentType: "bounty_builder",
      buyInAmount: 100,
      rankingFeeAmount: 20,
      bountyPercentage: 50,
    });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player);
    const spy = staleTournament(await tournamentRow(t), {
      tournamentType: "normal",
      bountyPercentage: 80,
      buyInAmount: 999,
    });

    const res = await confirmBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).not.toHaveProperty("error");
    // floor((100 - 20) * 50 / 100) === 40
    expect((await participantRow(part)).currentBounty).toBe(40);
    const buyIns = await playerTransactions(t, player, "buy_in");
    expect(buyIns.map((tx) => tx.amount)).toEqual([100]);
  });

  it("buy-in já confirmado no banco devolve erro e mantém uma única transação buy_in", async () => {
    const t = await seedTournament({ status: "pending", buyInAmount: 100 });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player);
    expect(await confirmBuyIn(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { buyInPaid: false, status: "registered" });

    const res = await confirmBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Buy-in ja confirmado" });
    expect(await playerTransactions(t, player, "buy_in")).toHaveLength(1);
  });

  it("Status que não permite mais inscrição no banco devolve a recusa do Status e não grava", async () => {
    const t = await seedTournament({ status: "finished", buyInAmount: 100 });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player);
    const spy = staleTournament(await tournamentRow(t), { status: "pending" });

    const res = await confirmBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: STATUS_RULES.registration.error });
    expect((await participantRow(part)).buyInPaid).toBe(false);
    expect(await allTransactions(t)).toHaveLength(0);
  });
});

describe("addAddon relê torneio e participante dentro do lock", () => {
  it("addonCount sai do participante no banco + 1 e casa com as transações addon", async () => {
    const t = await seedTournament({ addonAmount: 30, allowAddon: true });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
    expect(await addAddon(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { addonCount: 0 });

    const res = await addAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).not.toHaveProperty("error");
    expect((await participantRow(part)).addonCount).toBe(2);
    expect(await playerTransactions(t, player, "addon")).toHaveLength(2);
  });

  it("amount sai do addonAmount do torneio no banco", async () => {
    const t = await seedTournament({ addonAmount: 30, allowAddon: true });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
    const spy = staleTournament(await tournamentRow(t), { addonAmount: 999 });

    const res = await addAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).not.toHaveProperty("error");
    const addons = await playerTransactions(t, player, "addon");
    expect(addons.map((tx) => tx.amount)).toEqual([30]);
  });

  it("allowAddon falso no banco devolve erro e não grava nada", async () => {
    const t = await seedTournament({ addonAmount: 30, allowAddon: false });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
    const spy = staleTournament(await tournamentRow(t), { allowAddon: true });

    const res = await addAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Torneio nao permite add-on" });
    expect((await participantRow(part)).addonCount).toBe(0);
    expect(await playerTransactions(t, player, "addon")).toHaveLength(0);
  });

  it("buy-in não pago no banco devolve erro e não grava nada", async () => {
    const t = await seedTournament({ addonAmount: 30, allowAddon: true });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player);
    const spy = staleParticipant(await participantRow(part), { buyInPaid: true, status: "playing" });

    const res = await addAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Jogador ainda nao pagou buy-in" });
    expect((await participantRow(part)).addonCount).toBe(0);
    expect(await playerTransactions(t, player, "addon")).toHaveLength(0);
  });

  it("Status que não está mais Rodando no banco devolve a recusa do Status e não grava", async () => {
    const t = await seedTournament({ status: "finished", addonAmount: 30, allowAddon: true });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
    const spy = staleTournament(await tournamentRow(t), { status: "running" });

    const res = await addAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: STATUS_RULES.live.error });
    expect(await playerTransactions(t, player, "addon")).toHaveLength(0);
  });
});

describe("undoAddon relê o participante dentro do lock", () => {
  it("addonCount 0 no banco devolve erro e não apaga nenhuma transação", async () => {
    const t = await seedTournament({ buyInAmount: 100, addonAmount: 30, allowAddon: true, status: "pending" });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player);
    expect(await confirmBuyIn(part)).not.toHaveProperty("error");
    await testDb.update(tournaments).set({ status: "running" }).where(eq(tournaments.id, t));
    const before = await allTransactions(t);
    const spy = staleParticipant(await participantRow(part), { addonCount: 1 });

    const res = await undoAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Nenhum add-on para desfazer" });
    expect(await allTransactions(t)).toEqual(before);
    expect((await participantRow(part)).addonCount).toBe(0);
  });

  it("grava addonCount do banco - 1 e apaga uma transação addon", async () => {
    const t = await seedTournament({ addonAmount: 30, allowAddon: true });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
    expect(await addAddon(part)).not.toHaveProperty("error");
    expect(await addAddon(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { addonCount: 1 });

    const res = await undoAddon(part);

    expect(spy).toHaveBeenCalled();
    expect(res).not.toHaveProperty("error");
    expect((await participantRow(part)).addonCount).toBe(1);
    expect(await playerTransactions(t, player, "addon")).toHaveLength(1);
  });
});

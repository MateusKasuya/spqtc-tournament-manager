import { describe, it, expect, vi, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  confirmBuyIn,
  undoBuyIn,
  addAddon,
  undoAddon,
  addRebuy,
  addBonusChip,
  undoBonusChip,
  eliminatePlayer,
  undoElimination,
} from "@/actions/participants";
import { updateTournamentStatus } from "@/actions/tournaments";
import * as knockoutLedger from "@/db/ledger/knockout-ledger";
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

async function playerTransactions(tournamentId: number, playerId: number, type: "buy_in" | "addon" | "rebuy") {
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

describe("undoBuyIn relê torneio e participante dentro do lock", () => {
  const BLOCKED = "Desfaca rebuys, add-ons, bonus e bounties antes de remover o buy-in";

  async function paidParticipant(overrides: Partial<typeof tournaments.$inferInsert> = {}) {
    const t = await seedTournament({ buyInAmount: 100, ...overrides });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player);
    expect(await confirmBuyIn(part)).not.toHaveProperty("error");
    return { t, player, part };
  }

  async function expectBuyInKept(t: number, player: number, part: number) {
    const row = await participantRow(part);
    expect(row.status).toBe("playing");
    expect(row.buyInPaid).toBe(true);
    expect(await playerTransactions(t, player, "buy_in")).toHaveLength(1);
  }

  it("Rebuy confirmado no banco devolve erro e mantém buy_in e rebuy", async () => {
    const { t, player, part } = await paidParticipant({ rebuyAmount: 100 });
    expect(await addRebuy(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { rebuyCount: 0 });

    const res = await undoBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: BLOCKED });
    await expectBuyInKept(t, player, part);
    expect(await playerTransactions(t, player, "rebuy")).toHaveLength(1);
  });

  it("add-on confirmado no banco devolve erro e mantém buy_in e addon", async () => {
    const { t, player, part } = await paidParticipant({ addonAmount: 30, allowAddon: true });
    expect(await addAddon(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { addonCount: 0 });

    const res = await undoBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: BLOCKED });
    await expectBuyInKept(t, player, part);
    expect((await participantRow(part)).addonCount).toBe(1);
    expect(await playerTransactions(t, player, "addon")).toHaveLength(1);
  });

  it("bônus usado no banco devolve erro e mantém o buy-in", async () => {
    const { t, player, part } = await paidParticipant({ bonusChipAmount: 5000 });
    expect(await addBonusChip(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { bonusChipUsed: false });

    const res = await undoBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: BLOCKED });
    await expectBuyInKept(t, player, part);
    expect((await participantRow(part)).bonusChipUsed).toBe(true);
  });

  it("Bounty recolhido no banco devolve erro e mantém o buy-in", async () => {
    const { t, player, part } = await paidParticipant();
    await testDb.update(participants).set({ bountiesCollected: 1 }).where(eq(participants.id, part));
    const spy = staleParticipant(await participantRow(part), { bountiesCollected: 0 });

    const res = await undoBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: BLOCKED });
    await expectBuyInKept(t, player, part);
  });

  it("participante eliminado no banco devolve erro e mantém eliminação e buy_in", async () => {
    const t = await seedTournament({ buyInAmount: 100 });
    const players = [await seedPlayer("A"), await seedPlayer("B"), await seedPlayer("C")];
    const parts: number[] = [];
    for (const player of players) {
      const part = await seedParticipant(t, player);
      expect(await confirmBuyIn(part)).not.toHaveProperty("error");
      parts.push(part);
    }
    const [victim] = parts;
    expect(await eliminatePlayer(victim, [players[1]])).not.toHaveProperty("error");
    const eliminated = await participantRow(victim);
    const spy = staleParticipant(eliminated, { status: "playing", finishPosition: null, eliminatedAt: null });

    const res = await undoBuyIn(victim);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Desfaca a eliminacao antes de remover o buy-in" });
    const row = await participantRow(victim);
    expect(row.status).toBe(eliminated.status);
    expect(row.buyInPaid).toBe(true);
    expect(row.finishPosition).toBe(eliminated.finishPosition);
    expect(row.eliminatedAt).toEqual(eliminated.eliminatedAt);
    expect(await playerTransactions(t, players[0], "buy_in")).toHaveLength(1);
  });

  it("Status que não permite mais buy-in no banco devolve a recusa do Status e não apaga nada", async () => {
    const { t, player, part } = await paidParticipant();
    await testDb.update(tournaments).set({ status: "finished" }).where(eq(tournaments.id, t));
    const spy = staleTournament(await tournamentRow(t), { status: "running" });

    const res = await undoBuyIn(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: STATUS_RULES.registration.error });
    await expectBuyInKept(t, player, part);
  });
});

describe("addBonusChip e undoBonusChip releem torneio e participante dentro do lock", () => {
  async function playing(overrides: Partial<typeof tournaments.$inferInsert> = {}) {
    const t = await seedTournament({ bonusChipAmount: 5000, ...overrides });
    const player = await seedPlayer();
    const part = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
    return { t, part };
  }

  it("addBonusChip com bônus já usado no banco devolve erro", async () => {
    const { part } = await playing();
    expect(await addBonusChip(part)).not.toHaveProperty("error");
    const spy = staleParticipant(await participantRow(part), { bonusChipUsed: false });

    const res = await addBonusChip(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Bonus chip ja utilizado" });
    expect((await participantRow(part)).bonusChipUsed).toBe(true);
  });

  it("addBonusChip com participante fora de jogo no banco devolve erro e não grava", async () => {
    const { part } = await playing();
    await testDb.update(participants).set({ status: "eliminated" }).where(eq(participants.id, part));
    const spy = staleParticipant(await participantRow(part), { status: "playing" });

    const res = await addBonusChip(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Participante nao esta em jogo" });
    expect((await participantRow(part)).bonusChipUsed).toBe(false);
  });

  it("addBonusChip com bonusChipAmount 0 no banco devolve erro e não grava", async () => {
    const { t, part } = await playing({ bonusChipAmount: 0 });
    const spy = staleTournament(await tournamentRow(t), { bonusChipAmount: 5000 });

    const res = await addBonusChip(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Torneio nao permite bonus chip" });
    expect((await participantRow(part)).bonusChipUsed).toBe(false);
  });

  it("undoBonusChip com bônus não usado no banco devolve erro", async () => {
    const { part } = await playing();
    const spy = staleParticipant(await participantRow(part), { bonusChipUsed: true });

    const res = await undoBonusChip(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: "Bonus chip nao foi utilizado" });
    expect((await participantRow(part)).bonusChipUsed).toBe(false);
  });

  it("addBonusChip com torneio Encerrado no banco devolve a recusa do Status e não grava", async () => {
    const { t, part } = await playing({ status: "finished" });
    const spy = staleTournament(await tournamentRow(t), { status: "running" });

    const res = await addBonusChip(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: STATUS_RULES.live.error });
    expect((await participantRow(part)).bonusChipUsed).toBe(false);
  });

  it("undoBonusChip com torneio Encerrado no banco devolve a recusa do Status e não grava", async () => {
    const { t, part } = await playing();
    expect(await addBonusChip(part)).not.toHaveProperty("error");
    await testDb.update(tournaments).set({ status: "finished" }).where(eq(tournaments.id, t));
    const spy = staleTournament(await tournamentRow(t), { status: "running" });

    const res = await undoBonusChip(part);

    expect(spy).toHaveBeenCalled();
    expect(res).toEqual({ error: STATUS_RULES.live.error });
    expect((await participantRow(part)).bonusChipUsed).toBe(true);
  });
});

// Encerrar entre a checagem de fora e o lock: a leitura de fora (torneio e
// snapshot do Ledger) ainda vê Rodando, o banco já está Encerrado com os pontos
// calculados. O Knockout ou o Desfazer é recusado e nada muda nos pontos.
describe("Knockout e Desfazer releem o Status do torneio dentro do lock", () => {
  async function knockoutRows(t: number) {
    const parts = await testDb.select().from(participants).where(eq(participants.tournamentId, t)).orderBy(participants.id);
    return { parts, rows: await allTransactions(t) };
  }

  // Três em jogo com Rebuy permitido; `prepare` monta o estado com o torneio Rodando.
  const cases: {
    label: string;
    prepare: (ids: number[]) => Promise<unknown>;
    call: (ids: number[]) => Promise<unknown>;
  }[] = [
    { label: "eliminatePlayer", prepare: async () => {}, call: (ids) => eliminatePlayer(ids[0]) },
    { label: "addRebuy", prepare: async () => {}, call: (ids) => addRebuy(ids[0]) },
    {
      label: "undoElimination",
      prepare: async (ids) => expect(await eliminatePlayer(ids[0])).not.toHaveProperty("error"),
      call: (ids) => undoElimination(ids[0]),
    },
  ];

  it.each(cases)("$label com o torneio Encerrado no banco devolve erro e não grava nada", async ({ prepare, call }) => {
    const t = await seedTournament({ status: "running", rebuyAmount: 50 });
    const ids: number[] = [];
    for (const name of ["P0", "P1", "P2"]) {
      ids.push(await seedParticipant(t, await seedPlayer(name), { status: "playing", buyInPaid: true }));
    }
    await prepare(ids);

    const staleRow = await tournamentRow(t);
    const staleSnapshot = await knockoutLedger.loadKnockoutSnapshot(testDb, t);
    expect(await updateTournamentStatus(t, "finished")).toEqual({ success: true });
    const before = await knockoutRows(t);

    const tournamentSpy = staleTournament(staleRow, {});
    const snapshotSpy = vi.spyOn(knockoutLedger, "loadKnockoutSnapshot").mockResolvedValueOnce(staleSnapshot);

    const res = await call(ids);

    expect(tournamentSpy).toHaveBeenCalled();
    expect(snapshotSpy).toHaveBeenCalled();
    // Mensagem do LedgerStateChangedError: a recusa veio de dentro do lock.
    expect(res).toEqual({ error: "A mesa mudou, recarregue e tente de novo" });
    expect(await knockoutRows(t)).toEqual(before);
    expect((await tournamentRow(t)).status).toBe("finished");
  });
});

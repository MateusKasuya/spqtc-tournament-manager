import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  addParticipant,
  addParticipants,
  removeParticipant,
  confirmBuyIn,
  undoBuyIn,
  addRebuy,
  addDoubleRebuy,
  addAddon,
  addBonusChip,
  eliminatePlayer,
  undoRebuy,
  undoAddon,
  undoBonusChip,
  undoElimination,
} from "@/actions/participants";
import {
  updateBlindStructure,
  updatePrizeStructure,
  deletePrizeStructure,
  startTimer,
  pauseTimer,
  advanceBlindLevel,
  goBackBlindLevel,
  expireLevel,
  startBreak,
  endBreak,
} from "@/actions/tournaments";
import { testDb } from "@/test/db";
import * as schema from "@/db/schema";
import { tournaments, participants } from "@/db/schema";
import { STATUS_RULES, type TournamentStatus } from "@/lib/tournament-status";
import { seedTournament, seedPlayer, seedParticipant, seedPlayingParticipants, makeLevels } from "@/test/setup";

const ALL_STATUSES: TournamentStatus[] = ["pending", "running", "finished", "cancelled"];

// Prepara o estado com o torneio Rodando (para que as ações de preparo passem) e
// devolve a chamada a testar; o status é trocado só depois do preparo.
interface Row {
  label: string;
  prepare: (t: number) => Promise<() => Promise<unknown>>;
}

const MUTABLE_TABLES = [schema.tournaments, schema.participants, schema.transactions, schema.blindStructures, schema.prizeStructures];

async function dumpDb() {
  return Promise.all(MUTABLE_TABLES.map((table) => testDb.select().from(table)));
}

async function setStatus(t: number, status: TournamentStatus) {
  await testDb.update(tournaments).set({ status }).where(eq(tournaments.id, t));
}

const LIVE_TOURNAMENT = { rebuyAmount: 50, allowAddon: true, addonAmount: 30, bonusChipAmount: 5000 };

// Para cada grupo da regra: recusa nos status proibidos, sem gravar nada e com a
// mesma mensagem do grupo; aceitação nos permitidos.
function describeGroup(
  name: string,
  rule: { allowed: readonly TournamentStatus[]; error: string },
  rows: Row[],
  tournamentOverrides: Partial<typeof tournaments.$inferInsert> = {}
) {
  const forbidden = ALL_STATUSES.filter((s) => !rule.allowed.includes(s));
  const cases = (statuses: readonly TournamentStatus[]) =>
    rows.flatMap((row) => statuses.map((status) => ({ ...row, status })));

  describe(name, () => {
    it.each(cases(forbidden))("$label com torneio $status e recusado sem gravar nada", async ({ prepare, status }) => {
      const t = await seedTournament({ ...tournamentOverrides, status: "running" });
      const call = await prepare(t);
      await setStatus(t, status);
      const before = await dumpDb();

      expect(await call()).toEqual({ error: rule.error });
      expect(await dumpDb()).toEqual(before);
    });

    it.each(cases(rule.allowed))("$label com torneio $status e aceito", async ({ prepare, status }) => {
      const t = await seedTournament({ ...tournamentOverrides, status: "running" });
      const call = await prepare(t);
      await setStatus(t, status);

      expect(await call()).not.toHaveProperty("error");
    });
  });
}

describeGroup("inscricao e buy-in: Pendente ou Rodando", STATUS_RULES.registration, [
  {
    label: "addParticipant",
    prepare: async (t) => {
      const player = await seedPlayer();
      return () => addParticipant(t, player);
    },
  },
  {
    label: "addParticipants",
    prepare: async (t) => {
      const player = await seedPlayer();
      return () => addParticipants(t, [player]);
    },
  },
  {
    label: "removeParticipant",
    prepare: async (t) => {
      const p = await seedParticipant(t, await seedPlayer());
      return () => removeParticipant(p);
    },
  },
  {
    label: "confirmBuyIn",
    prepare: async (t) => {
      const p = await seedParticipant(t, await seedPlayer());
      return () => confirmBuyIn(p);
    },
  },
  {
    label: "undoBuyIn",
    prepare: async (t) => {
      const p = await seedParticipant(t, await seedPlayer());
      await confirmBuyIn(p);
      return () => undoBuyIn(p);
    },
  },
]);

// Três em jogo: a Vítima de um Knockout não coroa ninguém.
async function playing(t: number) {
  return seedPlayingParticipants(t, 3);
}

describeGroup(
  "Knockout, Rebuy, add-on, bonus e Desfazer: so Rodando",
  STATUS_RULES.live,
  [
    { label: "addRebuy", prepare: async (t) => { const [p] = await playing(t); return () => addRebuy(p); } },
    { label: "addDoubleRebuy", prepare: async (t) => { const [p] = await playing(t); return () => addDoubleRebuy(p); } },
    { label: "addAddon", prepare: async (t) => { const [p] = await playing(t); return () => addAddon(p); } },
    { label: "addBonusChip", prepare: async (t) => { const [p] = await playing(t); return () => addBonusChip(p); } },
    { label: "eliminatePlayer", prepare: async (t) => { const [p] = await playing(t); return () => eliminatePlayer(p); } },
    {
      label: "undoRebuy",
      prepare: async (t) => {
        const [p] = await playing(t);
        expect(await addRebuy(p)).not.toHaveProperty("error");
        return () => undoRebuy(p);
      },
    },
    {
      label: "undoAddon",
      prepare: async (t) => {
        const [p] = await playing(t);
        expect(await addAddon(p)).not.toHaveProperty("error");
        return () => undoAddon(p);
      },
    },
    {
      label: "undoBonusChip",
      prepare: async (t) => {
        const [p] = await playing(t);
        expect(await addBonusChip(p)).not.toHaveProperty("error");
        return () => undoBonusChip(p);
      },
    },
    {
      label: "undoElimination",
      prepare: async (t) => {
        const [p] = await playing(t);
        expect(await eliminatePlayer(p)).not.toHaveProperty("error");
        return () => undoElimination(p);
      },
    },
  ],
  LIVE_TOURNAMENT
);

// Relógio correndo no Nível 2 de 3: toda transição tem para onde ir.
async function clockRunning(t: number) {
  await testDb.insert(schema.blindStructures).values(makeLevels(3).map((l) => ({ ...l, tournamentId: t })));
}

describeGroup(
  "Relogio: so Rodando",
  STATUS_RULES.live,
  [
    { label: "startTimer", prepare: async (t) => { await clockRunning(t); return () => startTimer(t); } },
    { label: "pauseTimer", prepare: async (t) => { await clockRunning(t); return () => pauseTimer(t); } },
    { label: "advanceBlindLevel", prepare: async (t) => { await clockRunning(t); return () => advanceBlindLevel(t); } },
    { label: "goBackBlindLevel", prepare: async (t) => { await clockRunning(t); return () => goBackBlindLevel(t); } },
    {
      label: "expireLevel",
      prepare: async (t) => {
        await clockRunning(t);
        const [row] = await testDb.select({ startedAt: tournaments.timerStartedAt }).from(tournaments).where(eq(tournaments.id, t));
        return () => expireLevel(t, row.startedAt!.toISOString());
      },
    },
    { label: "startBreak", prepare: async (t) => { await clockRunning(t); return () => startBreak(t, 5); } },
    {
      label: "endBreak",
      prepare: async (t) => {
        await clockRunning(t);
        expect(await startBreak(t, 5)).not.toHaveProperty("error");
        return () => endBreak(t);
      },
    },
  ],
  { currentBlindLevel: 2, timerRunning: true, timerStartedAt: new Date(), timerRemainingSecs: 600 }
);

describeGroup("estruturas de blinds e de premios: Pendente ou Rodando", STATUS_RULES.structures, [
  { label: "updateBlindStructure", prepare: async (t) => () => updateBlindStructure(t, makeLevels(2)) },
  { label: "updatePrizeStructure", prepare: async (t) => () => updatePrizeStructure(t, [{ position: 1, percentage: 100 }]) },
  {
    label: "deletePrizeStructure",
    prepare: async (t) => {
      expect(await updatePrizeStructure(t, [{ position: 1, percentage: 100 }])).not.toHaveProperty("error");
      return () => deletePrizeStructure(t);
    },
  },
]);

describe("torneio inexistente", () => {
  it("addAddon de participante cujo torneio nao existe devolve 'Torneio nao encontrado'", async () => {
    const player = await seedPlayer();
    // Participante órfão: a FK com cascade impede o estado pelo caminho normal.
    await testDb.execute(sql`SET session_replication_role = replica`);
    try {
      const [orphan] = await testDb
        .insert(participants)
        .values({ tournamentId: 999999, playerId: player, status: "playing", buyInPaid: true })
        .returning({ id: participants.id });

      expect(await addAddon(orphan.id)).toEqual({ error: "Torneio nao encontrado" });
    } finally {
      await testDb.execute(sql`SET session_replication_role = origin`);
    }
  });
});

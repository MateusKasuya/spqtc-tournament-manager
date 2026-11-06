import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  updateTournamentStatus,
  deleteTournament,
} from "@/actions/tournaments";
import * as tournamentQueries from "@/db/queries/tournaments";
import { redirect } from "next/navigation";
import { testDb } from "@/test/db";
import * as schema from "@/db/schema";
import { tournaments, participants } from "@/db/schema";
import { STATUS_RULES, statusAllows, type TournamentStatus } from "@/lib/tournament-status";
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

// Excluir apaga em cascade participantes, transações e estruturas; um Encerrado
// carrega o histórico de dinheiro e os pontos do ranking da temporada.
describe("exclusao: Pendente ou Cancelado", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Torneio com participante, buy-in, estruturas de blinds e de prêmios: tudo
  // que o cascade apagaria.
  async function seedTournamentWithChildren(status: TournamentStatus) {
    const t = await seedTournament({ status: "running" });
    await clockRunning(t);
    expect(await updatePrizeStructure(t, [{ position: 1, percentage: 100 }])).not.toHaveProperty("error");
    const p = await seedParticipant(t, await seedPlayer());
    expect(await confirmBuyIn(p)).not.toHaveProperty("error");
    await setStatus(t, status);
    return t;
  }

  const byId = (a: number, b: number) => a - b;

  // Ids dos torneios que existem e dos que têm linhas em cada tabela filha.
  async function tournamentsWithRows() {
    const ids = (rows: { tournamentId: number }[]) => [...new Set(rows.map((r) => r.tournamentId))].sort(byId);
    const ts = await testDb.select({ id: tournaments.id }).from(tournaments);
    return {
      tournaments: ts.map((r) => r.id).sort(byId),
      children: [
        ids(await testDb.select({ tournamentId: schema.participants.tournamentId }).from(schema.participants)),
        ids(await testDb.select({ tournamentId: schema.transactions.tournamentId }).from(schema.transactions)),
        ids(await testDb.select({ tournamentId: schema.blindStructures.tournamentId }).from(schema.blindStructures)),
        ids(await testDb.select({ tournamentId: schema.prizeStructures.tournamentId }).from(schema.prizeStructures)),
      ],
    };
  }

  const forbidden = ALL_STATUSES.filter((s) => !statusAllows(STATUS_RULES.deletion, s));
  const allowed = ALL_STATUSES.filter((s) => statusAllows(STATUS_RULES.deletion, s));

  it("so Pendente e Cancelado permitem excluir", () => {
    expect(allowed).toEqual(["pending", "cancelled"]);
  });

  it.each(forbidden)("deleteTournament com torneio %s e recusado sem apagar nada", async (status) => {
    const t = await seedTournamentWithChildren(status);
    const before = await dumpDb();

    expect(await deleteTournament(t)).toEqual({ error: STATUS_RULES.deletion.error });
    expect(await dumpDb()).toEqual(before);
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(allowed)("deleteTournament com torneio %s apaga o torneio e as linhas filhas", async (status) => {
    const t = await seedTournamentWithChildren(status);
    const other = await seedTournamentWithChildren("pending");
    const both = [t, other].sort(byId);
    expect(await tournamentsWithRows()).toEqual({ tournaments: both, children: [both, both, both, both] });

    expect(await deleteTournament(t)).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith("/torneios");

    expect(await tournamentsWithRows()).toEqual({ tournaments: [other], children: [[other], [other], [other], [other]] });
  });

  it("deleteTournament com id inexistente devolve 'Torneio nao encontrado'", async () => {
    expect(await deleteTournament(999999)).toEqual({ error: "Torneio nao encontrado" });
    expect(redirect).not.toHaveBeenCalled();
  });

  // O pglite tem uma conexão só, então a corrida não se reproduz: a leitura de
  // fora do lock devolve Pendente enquanto o banco já está Encerrado.
  it("deleteTournament rele o Status dentro do lock e recusa se o torneio foi encerrado no meio", async () => {
    const t = await seedTournamentWithChildren("finished");
    const [row] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
    vi.spyOn(tournamentQueries, "getTournamentRequiringStatus").mockResolvedValueOnce({
      tournament: { ...row, status: "pending" },
    });
    const before = await dumpDb();

    expect(await deleteTournament(t)).toEqual({ error: STATUS_RULES.deletion.error });
    expect(await dumpDb()).toEqual(before);
    expect(redirect).not.toHaveBeenCalled();
  });
});

// Transições do Status do torneio: Encerrado e Cancelado são finais; Rodando não volta a Pendente.
const ALLOWED_TRANSITIONS: Record<TournamentStatus, readonly TournamentStatus[]> = {
  pending: ["running", "finished", "cancelled"],
  running: ["finished", "cancelled"],
  finished: [],
  cancelled: [],
};

// Re-encerrar é no-op silencioso de sucesso, coberto à parte.
const isRefinish = (from: TournamentStatus, to: TournamentStatus) => from === "finished" && to === "finished";

const TRANSITIONS = ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to) => ({ from, to })));

describe("updateTournamentStatus: transicoes do Status do torneio", () => {
  it.each(TRANSITIONS.filter(({ from, to }) => ALLOWED_TRANSITIONS[from].includes(to)))(
    "$from -> $to e aceita",
    async ({ from, to }) => {
      const t = await seedTournament({ status: from });

      expect(await updateTournamentStatus(t, to)).not.toHaveProperty("error");
      const [row] = await testDb.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, t));
      expect(row.status).toBe(to);
    }
  );

  it.each(TRANSITIONS.filter(({ from, to }) => !ALLOWED_TRANSITIONS[from].includes(to) && !isRefinish(from, to)))(
    "$from -> $to e recusada sem gravar nada",
    async ({ from, to }) => {
      const t = await seedTournament({ status: from });
      const before = await dumpDb();

      expect(await updateTournamentStatus(t, to)).toEqual({ error: "Transicao de status invalida" });
      expect(await dumpDb()).toEqual(before);
    }
  );

  // Torneio Rodando com dois que já caíram (pontuam ao Encerrar) e um em jogo.
  async function seedWithFinishers() {
    const t = await seedTournament({ status: "running" });
    const ids = [
      await seedParticipant(t, await seedPlayer("P0"), { status: "finished", buyInPaid: true, finishPosition: 1 }),
      await seedParticipant(t, await seedPlayer("P1"), { status: "eliminated", buyInPaid: true, finishPosition: 2 }),
      await seedParticipant(t, await seedPlayer("P2"), { status: "playing", buyInPaid: true }),
    ];
    return { t, ids };
  }

  async function pointsOf(t: number) {
    const rows = await testDb
      .select({ pointsEarned: participants.pointsEarned })
      .from(participants)
      .where(eq(participants.tournamentId, t))
      .orderBy(participants.id);
    return rows.map((r) => r.pointsEarned);
  }

  // Um Cancelar concorrente gravou antes do lock: a decisão sai da linha do banco.
  it("Encerrar com o torneio Cancelado no banco e recusado, sem gravar Status nem pontos", async () => {
    const { t } = await seedWithFinishers();
    await setStatus(t, "cancelled");
    const before = await dumpDb();

    expect(await updateTournamentStatus(t, "finished")).toEqual({ error: "Transicao de status invalida" });
    expect(await dumpDb()).toEqual(before);
    const [row] = await testDb.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, t));
    expect(row.status).toBe("cancelled");
    expect(await pointsOf(t)).toEqual(["0.00", "0.00", "0.00"]);
  });

  it("re-encerrar nao recalcula os pontos ja gravados", async () => {
    const { t, ids } = await seedWithFinishers();
    expect(await updateTournamentStatus(t, "finished")).toEqual({ success: true });
    const points = await pointsOf(t);
    expect(points[0]).not.toBe("0.00");
    // Se re-encerrar recalculasse, a troca de posição mudaria os pontos.
    await testDb.update(participants).set({ finishPosition: 2 }).where(eq(participants.id, ids[0]));
    await testDb.update(participants).set({ finishPosition: 1 }).where(eq(participants.id, ids[1]));

    expect(await updateTournamentStatus(t, "finished")).toEqual({ success: true });
    expect(await pointsOf(t)).toEqual(points);
  });

  it("torneio inexistente devolve 'Torneio nao encontrado'", async () => {
    expect(await updateTournamentStatus(999999, "finished")).toEqual({ error: "Torneio nao encontrado" });
  });

  it("re-encerrar torneio Encerrado e sucesso sem efeito", async () => {
    const t = await seedTournament({ status: "finished" });
    const before = await dumpDb();

    expect(await updateTournamentStatus(t, "finished")).toEqual({ success: true });
    expect(await dumpDb()).toEqual(before);
  });
});

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

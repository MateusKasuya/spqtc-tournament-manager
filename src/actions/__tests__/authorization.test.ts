import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireAdmin } from "@/lib/require-admin";
import * as tournamentActions from "@/actions/tournaments";
import * as participantActions from "@/actions/participants";
import * as seasonActions from "@/actions/seasons";
import * as playerActions from "@/actions/players";
import * as blindTemplateActions from "@/actions/blind-templates";
import * as prizeTemplateActions from "@/actions/prize-templates";
import { testDb } from "@/test/db";
import * as schema from "@/db/schema";
import { seedTournament, seedPlayer, seedParticipant, seedSeason, makeLevels, TEST_USER_ID } from "@/test/setup";

const NOT_ADMIN = { error: "Apenas admins podem fazer isso" };

interface Fixture {
  t: number;
  player: number;
  participant: number;
  season: number;
}

type AdminAction = (f: Fixture) => Promise<unknown>;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const TOURNAMENT_FORM = { name: "Torneio", date: "2026-09-25", buyInAmount: "100", initialChips: "10000" };

// Lista explícita de todas as ações de admin: uma action nova precisa entrar aqui
// (o teste de completude abaixo falha se ficar de fora). Login, cadastro, logout
// e a leitura da mesa ao vivo não são ações de admin.
const ADMIN_ACTIONS: Record<string, { module: object; actions: Record<string, AdminAction> }> = {
  tournaments: {
    module: tournamentActions,
    actions: {
      createTournament: () => tournamentActions.createTournament(form(TOURNAMENT_FORM)),
      updateTournament: (f) => tournamentActions.updateTournament(f.t, form(TOURNAMENT_FORM)),
      updateTournamentStatus: (f) => tournamentActions.updateTournamentStatus(f.t, "finished"),
      deleteTournament: (f) => tournamentActions.deleteTournament(f.t),
      updateBlindStructure: (f) => tournamentActions.updateBlindStructure(f.t, makeLevels(2)),
      deletePrizeStructure: (f) => tournamentActions.deletePrizeStructure(f.t),
      updatePrizeStructure: (f) => tournamentActions.updatePrizeStructure(f.t, [{ position: 1, percentage: 100 }]),
      startTimer: (f) => tournamentActions.startTimer(f.t),
      pauseTimer: (f) => tournamentActions.pauseTimer(f.t),
      advanceBlindLevel: (f) => tournamentActions.advanceBlindLevel(f.t),
      goBackBlindLevel: (f) => tournamentActions.goBackBlindLevel(f.t),
      expireLevel: (f) => tournamentActions.expireLevel(f.t, null),
      startBreak: (f) => tournamentActions.startBreak(f.t, 5),
      endBreak: (f) => tournamentActions.endBreak(f.t),
    },
  },
  participants: {
    module: participantActions,
    actions: {
      addParticipant: (f) => participantActions.addParticipant(f.t, f.player),
      addParticipants: (f) => participantActions.addParticipants(f.t, [f.player]),
      removeParticipant: (f) => participantActions.removeParticipant(f.participant),
      confirmBuyIn: (f) => participantActions.confirmBuyIn(f.participant),
      undoBuyIn: (f) => participantActions.undoBuyIn(f.participant),
      addRebuy: (f) => participantActions.addRebuy(f.participant),
      addDoubleRebuy: (f) => participantActions.addDoubleRebuy(f.participant),
      addAddon: (f) => participantActions.addAddon(f.participant),
      undoRebuy: (f) => participantActions.undoRebuy(f.participant),
      undoAddon: (f) => participantActions.undoAddon(f.participant),
      addBonusChip: (f) => participantActions.addBonusChip(f.participant),
      undoBonusChip: (f) => participantActions.undoBonusChip(f.participant),
      eliminatePlayer: (f) => participantActions.eliminatePlayer(f.participant),
      undoElimination: (f) => participantActions.undoElimination(f.participant),
      distributePayouts: (f) =>
        participantActions.distributePayouts(f.t, [{ playerId: f.player, amount: 100, position: 1 }]),
    },
  },
  seasons: {
    module: seasonActions,
    actions: {
      createSeason: () => seasonActions.createSeason(form({ name: "Temporada", startDate: "2026-01-01" })),
      deleteSeason: (f) => seasonActions.deleteSeason(f.season),
      toggleSeasonActive: (f) => seasonActions.toggleSeasonActive(f.season),
    },
  },
  players: {
    module: playerActions,
    actions: {
      createPlayer: () => playerActions.createPlayer(form({ name: "Novo" })),
      updatePlayer: (f) => playerActions.updatePlayer(f.player, form({ name: "Outro" })),
      deletePlayer: (f) => playerActions.deletePlayer(f.player),
    },
  },
  "blind-templates": {
    module: blindTemplateActions,
    actions: {
      saveBlindTemplate: () => blindTemplateActions.saveBlindTemplate("Modelo", makeLevels(2)),
      deleteBlindTemplate: () => blindTemplateActions.deleteBlindTemplate(1),
    },
  },
  "prize-templates": {
    module: prizeTemplateActions,
    actions: {
      savePrizeTemplate: () => prizeTemplateActions.savePrizeTemplate("Modelo", [{ position: 1, percentage: 100 }]),
      deletePrizeTemplate: () => prizeTemplateActions.deletePrizeTemplate(1),
    },
  },
};

const MUTABLE_TABLES = [
  schema.tournaments,
  schema.participants,
  schema.transactions,
  schema.blindStructures,
  schema.prizeStructures,
  schema.seasons,
  schema.players,
  schema.blindTemplates,
  schema.prizeTemplates,
];

async function dumpDb() {
  return Promise.all(MUTABLE_TABLES.map((table) => testDb.select().from(table)));
}

// Torneio rodando com o Relógio correndo, um participante com buy-in, uma
// temporada e um modelo de cada tipo: toda ação teria o que gravar se passasse.
async function seedFixture(): Promise<Fixture> {
  const season = await seedSeason();
  const t = await seedTournament({
    status: "running",
    seasonId: season,
    rebuyAmount: 50,
    allowAddon: true,
    addonAmount: 30,
    bonusChipAmount: 5000,
    currentBlindLevel: 1,
    timerRunning: true,
    timerStartedAt: new Date(),
    timerRemainingSecs: 600,
  });
  await testDb.insert(schema.blindStructures).values(makeLevels(3).map((l) => ({ ...l, tournamentId: t })));
  const player = await seedPlayer();
  const participant = await seedParticipant(t, player, { status: "playing", buyInPaid: true });
  await testDb.insert(schema.blindTemplates).values({ name: "B", levels: makeLevels(1), createdBy: TEST_USER_ID });
  await testDb.insert(schema.prizeTemplates).values({ name: "P", levels: [{ position: 1, percentage: 100 }], createdBy: TEST_USER_ID });
  return { t, player, participant, season };
}

const ROWS = Object.entries(ADMIN_ACTIONS).flatMap(([file, { actions }]) =>
  Object.entries(actions).map(([name, call]) => ({ label: `${file}.${name}`, call }))
);

describe("autorizacao das acoes de admin", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockResolvedValue(NOT_ADMIN);
  });

  afterEach(() => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: TEST_USER_ID } } as never);
  });

  it.each(ROWS)("$label sem admin retorna erro de permissao e nao grava nada", async ({ call }) => {
    const fixture = await seedFixture();
    const before = await dumpDb();

    const res = await call(fixture);

    expect(res).toEqual(NOT_ADMIN);
    expect(await dumpDb()).toEqual(before);
  });

  it.each(Object.entries(ADMIN_ACTIONS))("toda action exportada de %s esta na tabela", (_file, { module, actions }) => {
    expect(Object.keys(module).sort()).toEqual(Object.keys(actions).sort());
  });
});

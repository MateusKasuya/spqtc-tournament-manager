import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { updateTournament } from "@/actions/tournaments";
import { testDb } from "@/test/db";
import * as schema from "@/db/schema";
import { tournaments } from "@/db/schema";
import { CHIP_FIELDS } from "@/lib/tournament-edit";
import { STATUS_RULES, statusAllows, type TournamentStatus } from "@/lib/tournament-status";
import { seedTournament, seedPlayer, seedParticipant, seedSeason } from "@/test/setup";

// Regra do Status do torneio para editar o torneio (CONTEXT.md):
// dados: Pendente ou Rodando; fichas: so Pendente; taxa de ranking, tipo e
// percentual de Bounty: so Pendente e sem buy-in confirmado.

const ALL_STATUSES: TournamentStatus[] = ["pending", "running", "finished", "cancelled"];

const BOUNTY_RULE_CHANGES = {
  rankingFeeAmount: 500,
  tournamentType: "bounty_builder",
  bountyPercentage: 60,
} as const;

// Formulario fiel ao estado atual do torneio (o formulario da tela reenvia todos
// os campos), com as alteracoes pedidas por cima.
async function formFor(t: number, changes: Record<string, string | number | boolean> = {}) {
  const [row] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
  const fields: Record<string, string | number | boolean | null> = {
    name: row.name,
    seasonId: row.seasonId,
    date: row.date.toISOString(),
    buyInAmount: row.buyInAmount,
    rebuyAmount: row.rebuyAmount,
    addonAmount: row.addonAmount,
    initialChips: row.initialChips,
    rebuyChips: row.rebuyChips,
    addonChips: row.addonChips,
    bonusChipAmount: row.bonusChipAmount,
    maxRebuys: row.maxRebuys,
    allowAddon: row.allowAddon,
    rankingFeeAmount: row.rankingFeeAmount,
    tournamentType: row.tournamentType,
    bountyPercentage: row.bountyPercentage,
    ...changes,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null) fd.set(k, String(v));
  }
  return fd;
}

// O nome padrao do seed (1 caractere) nao passa a validacao do formulario.
function seed(overrides: Parameters<typeof seedTournament>[0] = {}) {
  return seedTournament({ name: "Torneio", ...overrides });
}

async function tournamentRow(t: number) {
  const [row] = await testDb.select().from(tournaments).where(eq(tournaments.id, t));
  return row;
}

async function dumpDb() {
  return Promise.all([schema.tournaments, schema.participants, schema.transactions].map((table) => testDb.select().from(table)));
}

async function confirmedBuyIn(t: number) {
  const player = await seedPlayer();
  await seedParticipant(t, player, { status: "playing", buyInPaid: true });
}

describe("Encerrado e Cancelado: nada e editavel", () => {
  const changes: { label: string; changes: Record<string, string | number> }[] = [
    { label: "nome", changes: { name: "Outro nome" } },
    { label: "fichas", changes: { initialChips: 20000 } },
    { label: "taxa de ranking", changes: { rankingFeeAmount: 500 } },
  ];

  const finals = ALL_STATUSES.filter((s) => !statusAllows(STATUS_RULES.tournamentData, s));
  const cases = changes.flatMap((c) => finals.map((status) => ({ ...c, status })));

  it.each(cases)("alterar $label com torneio $status e recusado sem gravar nada", async ({ changes, status }) => {
    const t = await seed({ status });
    const form = await formFor(t, changes);
    const before = await dumpDb();

    expect(await updateTournament(t, form)).toEqual({ error: STATUS_RULES.tournamentData.error });
    expect(await dumpDb()).toEqual(before);
  });

  it.each(finals)("reenviar o torneio sem mudar nada com torneio %s tambem e recusado", async (status) => {
    const t = await seed({ status });

    expect(await updateTournament(t, await formFor(t))).toEqual({ error: STATUS_RULES.tournamentData.error });
  });
});

describe("torneio Rodando", () => {
  it("aceita editar nome, data, temporada, valores em dinheiro, limite de Rebuys e permissao de add-on", async () => {
    const season = await seedSeason();
    const t = await seed({ status: "running" });
    await confirmedBuyIn(t);

    const result = await updateTournament(
      t,
      await formFor(t, {
        name: "Novo nome",
        date: "2026-12-24T22:00:00.000Z",
        seasonId: season,
        buyInAmount: 150,
        rebuyAmount: 80,
        addonAmount: 60,
        maxRebuys: 3,
        allowAddon: true,
      })
    );

    expect(result).toBeUndefined();
    const row = await tournamentRow(t);
    expect(row).toMatchObject({
      name: "Novo nome",
      seasonId: season,
      buyInAmount: 150,
      rebuyAmount: 80,
      addonAmount: 60,
      maxRebuys: 3,
      allowAddon: true,
    });
    expect(row.date.toISOString()).toBe("2026-12-24T22:00:00.000Z");
  });

  it.each(CHIP_FIELDS)("recusa alterar %s e nao grava nada", async (field) => {
    const t = await seed({ status: "running" });
    const form = await formFor(t, { [field]: 12345, name: "Outro nome" });
    const before = await dumpDb();

    expect(await updateTournament(t, form)).toEqual({ error: STATUS_RULES.chips.error });
    expect(await dumpDb()).toEqual(before);
  });

  it.each(Object.entries(BOUNTY_RULE_CHANGES))("recusa alterar %s e nao grava nada", async (field, value) => {
    const t = await seed({ status: "running" });
    const form = await formFor(t, { [field]: value, name: "Outro nome" });
    const before = await dumpDb();

    expect(await updateTournament(t, form)).toEqual({ error: STATUS_RULES.entryRules.error });
    expect(await dumpDb()).toEqual(before);
  });

  it("aceita reenviar fichas, taxa de ranking, tipo e percentual sem mudar, junto de uma edicao de dados", async () => {
    const t = await seed({ status: "running", rankingFeeAmount: 200, bountyPercentage: 40 });
    await confirmedBuyIn(t);

    expect(await updateTournament(t, await formFor(t, { name: "Novo nome" }))).toBeUndefined();
    expect((await tournamentRow(t)).name).toBe("Novo nome");
  });
});

describe("torneio Pendente", () => {
  it.each(CHIP_FIELDS)("aceita alterar %s mesmo com buy-in confirmado", async (field) => {
    const t = await seed({ status: "pending" });
    await confirmedBuyIn(t);

    expect(await updateTournament(t, await formFor(t, { [field]: 12345 }))).toBeUndefined();
    expect((await tournamentRow(t))[field]).toBe(12345);
  });

  it.each(Object.entries(BOUNTY_RULE_CHANGES))("aceita alterar %s enquanto nenhum buy-in foi confirmado", async (field, value) => {
    const t = await seed({ status: "pending" });
    // Participante inscrito mas Aguardando buy-in nao conta como buy-in confirmado.
    await seedParticipant(t, await seedPlayer(), { status: "registered", buyInPaid: false });

    expect(await updateTournament(t, await formFor(t, { [field]: value }))).toBeUndefined();
    expect((await tournamentRow(t))[field as keyof typeof BOUNTY_RULE_CHANGES]).toBe(value);
  });

  it.each(Object.entries(BOUNTY_RULE_CHANGES))("recusa alterar %s depois do primeiro buy-in confirmado e nao grava nada", async (field, value) => {
    const t = await seed({ status: "pending" });
    await confirmedBuyIn(t);
    const form = await formFor(t, { [field]: value, name: "Outro nome" });
    const before = await dumpDb();

    expect(await updateTournament(t, form)).toEqual({
      error: "Taxa de ranking, tipo e percentual de Bounty nao podem mudar depois do primeiro buy-in confirmado",
    });
    expect(await dumpDb()).toEqual(before);
  });

  it("aceita reenviar taxa de ranking, tipo e percentual sem mudar com buy-in confirmado", async () => {
    const t = await seed({ status: "pending", rankingFeeAmount: 200, bountyPercentage: 40 });
    await confirmedBuyIn(t);

    expect(await updateTournament(t, await formFor(t, { name: "Novo nome" }))).toBeUndefined();
    expect((await tournamentRow(t)).name).toBe("Novo nome");
  });
});

describe("torneio inexistente", () => {
  it("devolve 'Torneio nao encontrado'", async () => {
    const t = await seed();
    const form = await formFor(t);

    expect(await updateTournament(999999, form)).toEqual({ error: "Torneio nao encontrado" });
  });
});

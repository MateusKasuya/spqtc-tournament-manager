import { describe, it, expect } from "vitest";
import { createTournament } from "@/actions/tournaments";
import { testDb } from "@/test/db";
import { tournaments } from "@/db/schema";
import { BUY_IN_BELOW_RANKING_FEE_ERROR } from "@/lib/tournament-edit";
import { seedUser } from "@/test/setup";

// Buy-in ≥ taxa de ranking (CONTEXT.md, "Status do torneio"): ao criar, a
// regra vale sempre.

function form(fields: Record<string, string | number>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: "Torneio", date: "2026-11-06", initialChips: 10000, ...fields })) {
    fd.set(k, String(v));
  }
  return fd;
}

describe("createTournament: buy-in e taxa de ranking", () => {
  it.each(["normal", "bounty_builder"])("torneio %s com buy-in menor que a taxa e recusado e nao cria nada", async (tournamentType) => {
    const result = await createTournament(form({ buyInAmount: 1000, rankingFeeAmount: 2000, tournamentType }));

    expect(result).toEqual({ error: BUY_IN_BELOW_RANKING_FEE_ERROR });
    expect(await testDb.select().from(tournaments)).toEqual([]);
  });

  it("buy-in igual a taxa e aceito (Bounty zero)", async () => {
    await seedUser();
    const result = await createTournament(form({ buyInAmount: 2000, rankingFeeAmount: 2000, tournamentType: "bounty_builder" }));

    expect(result).toBeUndefined();
    expect(await testDb.select().from(tournaments)).toMatchObject([{ buyInAmount: 2000, rankingFeeAmount: 2000 }]);
  });
});

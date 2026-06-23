import { describe, it, expect, vi } from "vitest";
import { requireAdmin } from "@/lib/require-admin";
import { distributePayouts } from "@/actions/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { seedTournament, seedPlayer, seedParticipant } from "@/test/setup";

describe("autorizacao", () => {
  it("distributePayouts sem admin retorna error e nao grava premios", async () => {
    const t = await seedTournament();
    const player = await seedPlayer();
    await seedParticipant(t, player, { status: "playing", buyInPaid: true });

    vi.mocked(requireAdmin).mockResolvedValueOnce({ error: "Apenas admins podem fazer isso" });
    const res = await distributePayouts(t, [{ playerId: player, amount: 500, position: 1 }]);
    expect(res).toHaveProperty("error");

    const summary = await getTournamentFinancialSummary(t);
    expect(summary.prize).toBe(0);
  });
});

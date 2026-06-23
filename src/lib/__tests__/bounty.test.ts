import { describe, it, expect } from "vitest";
import { computeBountyDistribution } from "@/lib/bounty";

describe("computeBountyDistribution", () => {
  it("bounty 0 ou sem eliminadores → vazio", () => {
    expect(computeBountyDistribution(1, 0, [10], 1)).toEqual([]);
    expect(computeBountyDistribution(1, 100, [], 1)).toEqual([]);
  });
  it("1 eliminador, bounty par (100) → metade pagamento / metade acúmulo", () => {
    const [r] = computeBountyDistribution(1, 100, [10], 1);
    expect(r.amount).toBe(50);
    expect(r.bountyChange).toBe(50);
  });
  it("conserva o total: soma(amount)+soma(bountyChange) === bounty, p/ valores e Ns variados", () => {
    for (const b of [1, 7, 100, 101, 333]) {
      for (const n of [1, 2, 3, 5]) {
        const ids = Array.from({ length: n }, (_, i) => i + 1);
        const txs = computeBountyDistribution(1, b, ids, 1);
        const total = txs.reduce((s, t) => s + t.amount + t.bountyChange, 0);
        expect(total).toBe(b);
      }
    }
  });
  it("usa o eliminatorPlayerId (shorthand) quando a lista vem vazia", () => {
    const txs = computeBountyDistribution(1, 80, [], 1, 99);
    expect(txs).toHaveLength(1);
    expect(txs[0].playerId).toBe(99);
  });
});

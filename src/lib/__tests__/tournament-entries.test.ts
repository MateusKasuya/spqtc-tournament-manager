import { describe, it, expect } from "vitest";
import { allowsAddon, allowsBonusChip, rebuyLimit, totalPaid } from "@/lib/tournament-entries";

const tournament = { buyInAmount: 5000, rebuyAmount: 3000, addonAmount: 2000 };

describe("totalPaid", () => {
  it("soma buy-in confirmado, Rebuys e add-ons", () => {
    expect(totalPaid({ buyInPaid: true, rebuyCount: 2, addonCount: 1 }, tournament)).toBe(13000);
  });

  it("nao conta o buy-in de quem ainda nao confirmou", () => {
    expect(totalPaid({ buyInPaid: false, rebuyCount: 0, addonCount: 0 }, tournament)).toBe(0);
  });
});

describe("allowsAddon", () => {
  it("segue o add-on permitido no torneio", () => {
    expect(allowsAddon({ allowAddon: true })).toBe(true);
    expect(allowsAddon({ allowAddon: false })).toBe(false);
  });
});

describe("allowsBonusChip", () => {
  it("so permite bonus quando o torneio da fichas de bonus", () => {
    expect(allowsBonusChip({ bonusChipAmount: 10000 })).toBe(true);
    expect(allowsBonusChip({ bonusChipAmount: 0 })).toBe(false);
  });
});

describe("rebuyLimit", () => {
  it("devolve o limite de Rebuys, e null quando o limite e 0 (ilimitado)", () => {
    expect(rebuyLimit({ maxRebuys: 2 })).toBe(2);
    expect(rebuyLimit({ maxRebuys: 0 })).toBeNull();
  });
});

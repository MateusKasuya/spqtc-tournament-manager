import { describe, it, expect } from "vitest";
import { allowsAddon, allowsBonusChip, canRebuy, entryTotalPaid, hasConfirmedBuyIn, rebuyLimit, totalPaid } from "@/lib/tournament-entries";

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

describe("canRebuy", () => {
  const limit2 = { rebuyAmount: 3000, maxRebuys: 2 };

  it("recusa quando o torneio nao permite Rebuy", () => {
    expect(canRebuy({ rebuyCount: 0 }, { rebuyAmount: 0, maxRebuys: 0 }, 1)).toBe(false);
  });

  it("permite sempre quando o limite e 0 (ilimitado)", () => {
    expect(canRebuy({ rebuyCount: 50 }, { rebuyAmount: 3000, maxRebuys: 0 }, 2)).toBe(true);
  });

  it("permite o Rebuy que chega exatamente no limite", () => {
    expect(canRebuy({ rebuyCount: 1 }, limit2, 1)).toBe(true);
    expect(canRebuy({ rebuyCount: 0 }, limit2, 2)).toBe(true);
  });

  it("recusa o Rebuy duplo que passaria do limite", () => {
    expect(canRebuy({ rebuyCount: 1 }, limit2, 2)).toBe(false);
  });

  it("recusa qualquer Rebuy de quem ja esta no limite", () => {
    expect(canRebuy({ rebuyCount: 2 }, limit2, 1)).toBe(false);
  });
});

describe("hasConfirmedBuyIn", () => {
  it("segue o buy-in confirmado do Participante", () => {
    expect(hasConfirmedBuyIn({ buyInPaid: true })).toBe(true);
    expect(hasConfirmedBuyIn({ buyInPaid: false })).toBe(false);
  });
});

describe("entryTotalPaid", () => {
  it("na linha do historico, buy-in nao confirmado nao soma, mas Rebuys e add-ons somam", () => {
    const entry = { ...tournament, buyInPaid: false, rebuyCount: 2, addonCount: 1 };
    expect(entryTotalPaid(entry)).toBe(8000);
  });

  it("na linha do historico, buy-in confirmado soma junto com Rebuys e add-ons", () => {
    const entry = { ...tournament, buyInPaid: true, rebuyCount: 2, addonCount: 1 };
    expect(entryTotalPaid(entry)).toBe(13000);
  });
});

import { describe, it, expect } from "vitest";
import { editLocks, lockedFieldError, ENTRY_RULES_AFTER_BUY_IN_ERROR } from "@/lib/tournament-edit";
import { STATUS_RULES, type TournamentStatus } from "@/lib/tournament-status";

const CURRENT = {
  initialChips: 10000,
  rebuyChips: 10000,
  addonChips: 15000,
  bonusChipAmount: 0,
  rankingFeeAmount: 2000,
  tournamentType: "normal",
  bountyPercentage: 50,
  buyInAmount: 5000,
  rebuyAmount: 3000,
  addonAmount: 3000,
};

const MONEY_CHANGES = { buyInAmount: 6000, rebuyAmount: 4000, addonAmount: 2500 } as const;
const MONEY_CASES = Object.entries(MONEY_CHANGES);

describe("editLocks", () => {
  it("Pendente sem buy-in confirmado nao trava nada", () => {
    expect(editLocks("pending", false)).toEqual({ chips: false, entryRules: false });
  });

  it("Pendente com buy-in confirmado trava as regras de entrada, nao as fichas", () => {
    expect(editLocks("pending", true)).toEqual({ chips: false, entryRules: true });
  });

  it.each([true, false])("Rodando trava fichas e regras de entrada (buy-in confirmado: %s)", (hasBuyIn) => {
    expect(editLocks("running", hasBuyIn)).toEqual({ chips: true, entryRules: true });
  });
});

describe("lockedFieldError: valores de buy-in, Rebuy e add-on", () => {
  it.each(MONEY_CASES)("mudar %s com o torneio Rodando e recusado", (field, value) => {
    expect(lockedFieldError("running", true, CURRENT, { ...CURRENT, [field]: value })).toBe(STATUS_RULES.entryRules.error);
    expect(lockedFieldError("running", false, CURRENT, { ...CURRENT, [field]: value })).toBe(STATUS_RULES.entryRules.error);
  });

  it.each(MONEY_CASES)("mudar %s com o torneio Pendente e buy-in confirmado e recusado", (field, value) => {
    expect(lockedFieldError("pending", true, CURRENT, { ...CURRENT, [field]: value })).toBe(ENTRY_RULES_AFTER_BUY_IN_ERROR);
  });

  it.each(MONEY_CASES)("mudar %s com o torneio Pendente sem buy-in confirmado e aceito", (field, value) => {
    expect(lockedFieldError("pending", false, CURRENT, { ...CURRENT, [field]: value })).toBeNull();
  });

  const editable: { status: TournamentStatus; hasBuyIn: boolean }[] = [
    { status: "pending", hasBuyIn: false },
    { status: "pending", hasBuyIn: true },
    { status: "running", hasBuyIn: false },
    { status: "running", hasBuyIn: true },
  ];

  it.each(editable)("reenviar os valores sem mudanca passa ($status, buy-in confirmado: $hasBuyIn)", ({ status, hasBuyIn }) => {
    expect(lockedFieldError(status, hasBuyIn, CURRENT, { ...CURRENT })).toBeNull();
  });

  it("as mensagens de recusa citam os valores de buy-in, Rebuy e add-on", () => {
    for (const message of [STATUS_RULES.entryRules.error, ENTRY_RULES_AFTER_BUY_IN_ERROR]) {
      expect(message).toMatch(/buy-in, Rebuy e add-on/);
    }
  });
});

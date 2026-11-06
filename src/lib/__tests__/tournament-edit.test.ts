import { describe, it, expect } from "vitest";
import {
  editLocks,
  lockedFieldError,
  buyInBelowRankingFeeError,
  BUY_IN_BELOW_RANKING_FEE_ERROR,
  ENTRY_RULES_AFTER_BUY_IN_ERROR,
} from "@/lib/tournament-edit";
import { STATUS_RULES, type TournamentStatus } from "@/lib/tournament-status";

const VALUES = {
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

function current(status: TournamentStatus, allowAddon = true) {
  return { status, allowAddon, ...VALUES };
}

const BUY_IN = { hasConfirmedBuyIn: true, hasAddon: false };
const NO_BUY_IN = { hasConfirmedBuyIn: false, hasAddon: false };

const MONEY_CHANGES = { buyInAmount: 6000, rebuyAmount: 4000, addonAmount: 2500 } as const;
const MONEY_CASES = Object.entries(MONEY_CHANGES);

describe("editLocks", () => {
  it("Pendente sem buy-in confirmado nao trava nada", () => {
    expect(editLocks({ status: "pending", allowAddon: true }, NO_BUY_IN)).toEqual({
      chips: false,
      entryRules: false,
      addonAmount: false,
    });
  });

  it("Pendente com buy-in confirmado trava as regras de entrada, nao as fichas", () => {
    expect(editLocks({ status: "pending", allowAddon: true }, BUY_IN)).toEqual({
      chips: false,
      entryRules: true,
      addonAmount: true,
    });
  });

  it.each([true, false])("Rodando trava fichas e regras de entrada (buy-in confirmado: %s)", (hasConfirmedBuyIn) => {
    expect(editLocks({ status: "running", allowAddon: true }, { hasConfirmedBuyIn, hasAddon: false })).toEqual({
      chips: true,
      entryRules: true,
      addonAmount: true,
    });
  });

  it.each(["pending", "running"] as const)(
    "valor do add-on fica livre com %s enquanto o add-on nao e permitido e ninguem fez add-on",
    (status) => {
      expect(editLocks({ status, allowAddon: false }, BUY_IN).addonAmount).toBe(false);
    }
  );

  it.each(["pending", "running"] as const)("valor do add-on trava com %s se alguem ja fez add-on, mesmo sem add-on permitido", (status) => {
    expect(editLocks({ status, allowAddon: false }, { hasConfirmedBuyIn: true, hasAddon: true }).addonAmount).toBe(true);
  });
});

describe("lockedFieldError: valores de buy-in, Rebuy e add-on", () => {
  it.each(MONEY_CASES)("mudar %s com o torneio Rodando e recusado", (field, value) => {
    expect(lockedFieldError(current("running"), BUY_IN, { ...VALUES, [field]: value })).toBe(STATUS_RULES.entryRules.error);
    expect(lockedFieldError(current("running"), NO_BUY_IN, { ...VALUES, [field]: value })).toBe(STATUS_RULES.entryRules.error);
  });

  it.each(MONEY_CASES)("mudar %s com o torneio Pendente e buy-in confirmado e recusado", (field, value) => {
    expect(lockedFieldError(current("pending"), BUY_IN, { ...VALUES, [field]: value })).toBe(ENTRY_RULES_AFTER_BUY_IN_ERROR);
  });

  it.each(MONEY_CASES)("mudar %s com o torneio Pendente sem buy-in confirmado e aceito", (field, value) => {
    expect(lockedFieldError(current("pending"), NO_BUY_IN, { ...VALUES, [field]: value })).toBeNull();
  });

  const editable: { status: TournamentStatus; hasConfirmedBuyIn: boolean }[] = [
    { status: "pending", hasConfirmedBuyIn: false },
    { status: "pending", hasConfirmedBuyIn: true },
    { status: "running", hasConfirmedBuyIn: false },
    { status: "running", hasConfirmedBuyIn: true },
  ];

  it.each(editable)("reenviar os valores sem mudanca passa ($status, buy-in confirmado: $hasConfirmedBuyIn)", ({ status, hasConfirmedBuyIn }) => {
    expect(lockedFieldError(current(status), { hasConfirmedBuyIn, hasAddon: true }, { ...VALUES })).toBeNull();
  });

  it("as mensagens de recusa citam os valores de buy-in, Rebuy e add-on", () => {
    for (const message of [STATUS_RULES.entryRules.error, ENTRY_RULES_AFTER_BUY_IN_ERROR]) {
      expect(message).toMatch(/buy-in, Rebuy e add-on/);
    }
  });
});

describe("lockedFieldError: ligar o add-on depois do primeiro buy-in", () => {
  it.each(["pending", "running"] as const)("torneio %s sem add-on permitido e sem add-on registrado aceita ligar o add-on com valor", (status) => {
    const before = { ...current(status, false), addonAmount: 0 };

    expect(lockedFieldError(before, BUY_IN, { ...VALUES, addonAmount: 3000 })).toBeNull();
  });

  it("torneio com add-on permitido e buy-in confirmado recusa mudar o valor do add-on", () => {
    expect(lockedFieldError(current("pending", true), BUY_IN, { ...VALUES, addonAmount: 2500 })).toBe(ENTRY_RULES_AFTER_BUY_IN_ERROR);
  });

  it("torneio com add-on desligado mas com add-on registrado recusa mudar o valor do add-on", () => {
    const facts = { hasConfirmedBuyIn: true, hasAddon: true };

    expect(lockedFieldError(current("running", false), facts, { ...VALUES, addonAmount: 2500 })).toBe(STATUS_RULES.entryRules.error);
  });

  it("valor do add-on livre nao destrava buy-in nem Rebuy", () => {
    expect(lockedFieldError(current("pending", false), BUY_IN, { ...VALUES, addonAmount: 2500, buyInAmount: 6000 })).toBe(
      ENTRY_RULES_AFTER_BUY_IN_ERROR
    );
  });
});

describe("buyInBelowRankingFeeError", () => {
  it.each([
    { label: "menor que a taxa e recusado", buyInAmount: 1000, expected: BUY_IN_BELOW_RANKING_FEE_ERROR },
    { label: "igual a taxa passa (Bounty zero)", buyInAmount: 2000, expected: null },
    { label: "maior que a taxa passa", buyInAmount: 5000, expected: null },
  ])("ao criar, buy-in $label", ({ buyInAmount, expected }) => {
    expect(buyInBelowRankingFeeError({ buyInAmount, rankingFeeAmount: 2000 })).toBe(expected);
  });

  const old = { buyInAmount: 100, rankingFeeAmount: 200 };

  it("ao editar, torneio gravado com buy-in menor que a taxa passa se nenhum dos dois muda", () => {
    expect(buyInBelowRankingFeeError({ ...old }, old)).toBeNull();
  });

  it("ao editar, mudar o buy-in para baixo da taxa e recusado", () => {
    expect(buyInBelowRankingFeeError({ buyInAmount: 1000, rankingFeeAmount: 2000 }, { buyInAmount: 5000, rankingFeeAmount: 2000 })).toBe(
      BUY_IN_BELOW_RANKING_FEE_ERROR
    );
  });

  it("ao editar, mudar a taxa para acima do buy-in e recusado", () => {
    expect(buyInBelowRankingFeeError({ buyInAmount: 5000, rankingFeeAmount: 6000 }, { buyInAmount: 5000, rankingFeeAmount: 2000 })).toBe(
      BUY_IN_BELOW_RANKING_FEE_ERROR
    );
  });

  it("ao editar, torneio gravado com buy-in menor que a taxa continua recusado se a mudanca nao resolve", () => {
    expect(buyInBelowRankingFeeError({ buyInAmount: 150, rankingFeeAmount: 200 }, old)).toBe(BUY_IN_BELOW_RANKING_FEE_ERROR);
  });

  it("ao editar, corrigir um torneio antigo para buy-in maior ou igual a taxa passa", () => {
    expect(buyInBelowRankingFeeError({ buyInAmount: 200, rankingFeeAmount: 200 }, old)).toBeNull();
  });
});

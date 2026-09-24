import { describe, it, expect } from "vitest";
import { calculateRoundedPrizeAmounts } from "@/lib/prize";

const DEFAULT_STRUCTURE = [45, 25, 15, 10, 5];
const FIVE_REAIS = 500;

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

describe("calculateRoundedPrizeAmounts", () => {
  it("Estrutura de prêmios padrão com Prize pool redondo: cada posição recebe o percentual exato", () => {
    expect(calculateRoundedPrizeAmounts(100000, DEFAULT_STRUCTURE)).toEqual([45000, 25000, 15000, 10000, 5000]);
  });

  it("arredonda cada Prêmio para múltiplo de R$5 e ajusta pelo maior resto para a soma bater com o Prize pool", () => {
    // Bruto: 373,50 / 207,50 / 124,50 / 83,00 / 41,50 → arredondado soma R$5 a mais;
    // o ajuste sai da posição que mais subiu no arredondamento (2º lugar).
    expect(calculateRoundedPrizeAmounts(83000, DEFAULT_STRUCTURE)).toEqual([37500, 20500, 12500, 8500, 4000]);
  });

  it.each([5000, 12500, 83000, 99500, 123000, 777500])(
    "Prize pool de %i centavos: todo Prêmio é múltiplo de R$5 e a soma é exatamente o Prize pool",
    (prizePool) => {
      const amounts = calculateRoundedPrizeAmounts(prizePool, DEFAULT_STRUCTURE);
      expect(amounts.every((v) => v % FIVE_REAIS === 0)).toBe(true);
      expect(sum(amounts)).toBe(prizePool);
    }
  );

  it("com percentuais empatados, a sobra do arredondamento fica com a 1ª posição", () => {
    // R$15 dividido 50/50: R$7,50 cada não é múltiplo de R$5; os R$5 extras vão para o 1º.
    expect(calculateRoundedPrizeAmounts(1500, [50, 50])).toEqual([1000, 500]);
  });

  it("centavos que não fecham R$5 vão para a 1ª posição", () => {
    const amounts = calculateRoundedPrizeAmounts(100003, DEFAULT_STRUCTURE);
    expect(amounts).toEqual([45003, 25000, 15000, 10000, 5000]);
    expect(sum(amounts)).toBe(100003);
  });

  it("Prize pool zero dá Prêmios zero", () => {
    expect(calculateRoundedPrizeAmounts(0, DEFAULT_STRUCTURE)).toEqual([0, 0, 0, 0, 0]);
  });

  it("sem Estrutura de prêmios não há Prêmios", () => {
    expect(calculateRoundedPrizeAmounts(100000, [])).toEqual([]);
  });
});

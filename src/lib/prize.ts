const ROUNDING_UNIT_CENTS = 500; // R$5 — final do valor sempre 0 ou 5

/**
 * Divide o prize pool (em centavos) pelas percentagens, arredondando cada
 * posicao para o multiplo de R$5 mais proximo. A soma dos valores retornados
 * sempre bate exatamente com prizePoolCents (metodo dos maiores restos,
 * generalizado pra unidade de R$5); sobra nao divisivel por R$5 (pool com
 * centavos quebrados) vai pra 1a posicao.
 */
export function calculateRoundedPrizeAmounts(
  prizePoolCents: number,
  percentages: number[]
): number[] {
  if (percentages.length === 0) return [];

  const raw = percentages.map((pct) => (prizePoolCents * pct) / 100);
  const rounded = raw.map(
    (value) => Math.round(value / ROUNDING_UNIT_CENTS) * ROUNDING_UNIT_CENTS
  );

  const diffUnits = Math.round(
    (prizePoolCents - rounded.reduce((sum, v) => sum + v, 0)) / ROUNDING_UNIT_CENTS
  );

  const remaindersDesc = raw
    .map((value, index) => ({ index, remainder: value - rounded[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  if (diffUnits > 0) {
    for (let i = 0; i < diffUnits && i < remaindersDesc.length; i++) {
      rounded[remaindersDesc[i].index] += ROUNDING_UNIT_CENTS;
    }
  } else if (diffUnits < 0) {
    for (let i = 0; i < -diffUnits && i < remaindersDesc.length; i++) {
      rounded[remaindersDesc[remaindersDesc.length - 1 - i].index] -= ROUNDING_UNIT_CENTS;
    }
  }

  const leftoverCents = prizePoolCents - rounded.reduce((sum, v) => sum + v, 0);
  if (leftoverCents !== 0) {
    rounded[0] += leftoverCents;
  }

  return rounded;
}

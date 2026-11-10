// Leitura do Relógio da Mesa ao vivo pelo Tempo restante na tela, reaproveitada
// pelas jornadas do e2e (quem pausa e quem só assiste).
import { expect, type Locator, type Page } from "@playwright/test";

export function remainingTimer(page: Page) {
  return page.getByRole("timer", { name: "Tempo restante" });
}

export async function secondsLeft(remaining: Locator) {
  const [minutes, seconds] = ((await remaining.textContent()) ?? "").split(":").map(Number);
  return minutes * 60 + seconds;
}

// Correndo: o Tempo restante desce dois tiques abaixo do ponto de partida.
export async function expectCountingDownFrom(remaining: Locator, from: number) {
  await expect.poll(() => secondsLeft(remaining), { timeout: 5_000 }).toBeLessThanOrEqual(from - 2);
}

// Parado só se prova esperando. A primeira espera deixa o refresh da pausa
// trocar o último tique do cliente pelo valor gravado no servidor; a segunda
// cobre mais de um tique do Relógio. Devolve o Tempo restante congelado.
export async function expectPaused(remaining: Locator) {
  await remaining.page().waitForTimeout(1_000);
  const paused = await secondsLeft(remaining);
  await remaining.page().waitForTimeout(2_500);
  expect(await secondsLeft(remaining)).toBe(paused);
  return paused;
}

import { expect, test, type Locator } from "@playwright/test";
import { E2E_USERS } from "./support/users";
import {
  confirmBuyIn,
  createPlayer,
  createTournament,
  openTournamentTab,
  participantRow,
  registerPlayers,
  uniqueName,
} from "./support/tournament";

test.use({ storageState: E2E_USERS.admin.storageState });

// Intl pt-BR separa "R$" do valor com espaço não separável.
const brl = (reais: number) => new RegExp(`R\\$\\s${reais},00`);

test("admin cria o torneio, confirma os buy-ins e roda o Relogio", async ({ page }) => {
  const players = [uniqueName("Ana"), uniqueName("Bruno")];
  const tournamentName = uniqueName("Torneio E2E");
  const buyIn = 50;
  let tournamentId = 0;

  await test.step("cria os Jogadores", async () => {
    for (const name of players) await createPlayer(page, name);
  });

  await test.step("cria o torneio, que fica Pendente com blinds e premios", async () => {
    tournamentId = await createTournament(page, {
      name: tournamentName,
      buyIn,
      initialChips: 10000,
      // Sem taxa de ranking: o Prize pool é a soma dos buy-ins.
      rankingFee: 0,
    });
    await expect(page.getByText("Pendente", { exact: true })).toBeVisible();

    await openTournamentTab(page, tournamentId, "Blinds");
    await expect(page.getByRole("row", { name: /^1 10 \/ 20 .* 15min$/ })).toBeVisible();
    await openTournamentTab(page, tournamentId, "Premios");
    await expect(page.getByRole("row", { name: /^1º lugar 45%/ })).toBeVisible();
  });

  await test.step("inscreve os Jogadores, que ficam aguardando buy-in", async () => {
    await registerPlayers(page, tournamentId, players);
    for (const name of players) {
      const row = participantRow(page, name);
      // Na tela, Aguardando buy-in aparece como "Registrado".
      await expect(row.getByText("Registrado", { exact: true })).toBeVisible();
      await expect(row.getByText("Nao pago", { exact: true })).toBeVisible();
    }
  });

  await test.step("confirma os buy-ins, que poem os Participantes em jogo", async () => {
    for (const name of players) {
      await confirmBuyIn(page, tournamentId, name);
      const row = participantRow(page, name);
      // Na tela, Em jogo aparece como "Jogando".
      await expect(row.getByText("Jogando", { exact: true })).toBeVisible();
      await expect(row.getByText(brl(buyIn))).toBeVisible();
    }

    await openTournamentTab(page, tournamentId, "Visao Geral");
    const financial = page.getByText("Prize pool", { exact: true }).locator("..");
    await expect(financial).toContainText(brl(buyIn * players.length));
  });

  await test.step("inicia o torneio, que fica Rodando", async () => {
    await page.getByRole("button", { name: "Iniciar torneio" }).click();
    await expect(page.getByText("Rodando", { exact: true })).toBeVisible();
  });

  await test.step("inicia, pausa e retoma o Relogio na Mesa ao vivo", async () => {
    await page.getByRole("link", { name: "Mesa ao Vivo" }).click();
    await page.waitForURL(`/torneios/${tournamentId}/mesa`);

    const remaining = page.getByRole("timer", { name: "Tempo restante" });

    await page.getByRole("button", { name: "Iniciar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
    // O Iniciar carrega os 15 minutos do Nível 1 do padrão; nenhum Fim do nível
    // cabe no teste (ADR 0002).
    await expect(remaining).toHaveText(/^1[45]:\d\d$/);
    await expectTicking(remaining);

    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Iniciar", exact: true })).toBeVisible();
    await expectStopped(remaining);

    await page.getByRole("button", { name: "Iniciar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
    await expectTicking(remaining);
  });
});

async function expectTicking(remaining: Locator) {
  const before = await remaining.textContent();
  await expect.poll(() => remaining.textContent(), { timeout: 5_000 }).not.toBe(before);
}

async function expectStopped(remaining: Locator) {
  // Parado só se prova esperando. A primeira espera deixa o refresh da pausa
  // trocar o último tique do cliente pelo valor gravado no servidor; a segunda
  // cobre mais de um tique do Relógio.
  await remaining.page().waitForTimeout(1_000);
  const paused = (await remaining.textContent()) ?? "";
  await remaining.page().waitForTimeout(2_500);
  await expect(remaining).toHaveText(paused);
}

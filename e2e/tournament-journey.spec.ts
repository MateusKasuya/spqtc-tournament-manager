import { expect, test } from "@playwright/test";
import { E2E_USERS } from "./support/users";
import {
  confirmBuyIn,
  createPlayer,
  createTournament,
  openTournamentTab,
  participantRow,
  registerPlayers,
  startTournament,
  uniqueName,
} from "./support/tournament";
import { brl } from "./support/text";
import { expectCountingDownFrom, expectStopped, remainingTimer, secondsLeft } from "./support/clock";

test.use({ storageState: E2E_USERS.admin.storageState });

const money = (reais: number) => new RegExp(brl(reais));

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
      // Diferente das fichas de Rebuy e add-on (10.000) para a tela distinguir.
      initialChips: 5000,
      // Sem taxa de ranking: o Prize pool é a soma dos buy-ins.
      rankingFee: 0,
    });
    await expect(page.getByText("Pendente", { exact: true })).toBeVisible();
    await expect(page.getByText("Iniciais", { exact: true }).locator("..")).toContainText(
      /Iniciais\s*5\.000/
    );

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
      await expect(row.getByText(money(buyIn))).toBeVisible();
    }

    await openTournamentTab(page, tournamentId, "Visao Geral");
    const financial = page.getByText("Prize pool", { exact: true }).locator("..");
    await expect(financial).toContainText(money(buyIn * players.length));
  });

  await test.step("inicia o torneio, que fica Rodando", async () => {
    await startTournament(page, tournamentId);
  });

  await test.step("inicia, pausa e retoma o Relogio na Mesa ao vivo", async () => {
    await page.getByRole("link", { name: "Mesa ao Vivo" }).click();
    await page.waitForURL(`/torneios/${tournamentId}/mesa`);

    const remaining = remainingTimer(page);
    const play = page.getByRole("button", { name: "Iniciar", exact: true });
    const pause = page.getByRole("button", { name: "Pausar", exact: true });
    // A troca do botão espera a action e o refresh; o build de produção do CI
    // pode passar do timeout padrão.
    const actionTimeout = { timeout: 15_000 };

    await play.click();
    await expect(pause).toBeVisible(actionTimeout);
    // O Iniciar carrega os 15 minutos do Nível 1 do padrão; nenhum Fim do nível
    // cabe no teste (ADR 0002).
    const started = await secondsLeft(remaining);
    expect(started).toBeGreaterThan(14 * 60);
    await expectCountingDownFrom(remaining, started);

    const beforePause = await secondsLeft(remaining);
    await pause.click();
    await expect(play).toBeVisible(actionTimeout);
    const paused = await expectStopped(remaining);
    expect(paused).toBeLessThan(started);
    expect(paused).toBeLessThanOrEqual(beforePause);

    await play.click();
    await expect(pause).toBeVisible(actionTimeout);
    // Retoma de onde parou, sem voltar aos 15 minutos.
    expect(await secondsLeft(remaining)).toBeLessThanOrEqual(paused);
    await expectCountingDownFrom(remaining, paused);
  });
});

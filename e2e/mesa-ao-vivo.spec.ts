import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USERS } from "./support/users";
import { ACTION_TIMEOUT, eliminate, expectStatCard, openMesa, rebuy } from "./support/mesa";
import { expectCountingDownFrom, expectStopped, remainingTimer, secondsLeft } from "./support/clock";
import { brl } from "./support/text";
import {
  confirmBuyIn,
  createPlayer,
  createTournament,
  openTournamentTab,
  registerPlayers,
  startTournament,
  uniqueName,
} from "./support/tournament";

// Dois navegadores ao mesmo tempo: o admin age no dele e o jogador só assiste à
// Mesa ao vivo no seu, sem recarregar. Cada mudança que chega ao jogador passou
// pelo realtime do Supabase e pelas policies de leitura (RLS) do usuário comum.
// O projeto "iphone" roda este mesmo arquivo em WebKit com o jogador no celular.

// O `page` do teste é o do jogador (no projeto "iphone", um iPhone).
test.use({ storageState: E2E_USERS.player.storageState });

// Valores redondos para conferir de cabeça: 4 buy-ins de R$ 50 dão R$ 200, e um
// Rebuy de R$ 100 leva a R$ 300; o padrão de prêmios (45/25/15/10/5%) estima
// R$ 135 para o 1º e R$ 75 para o 2º.
const BUY_IN = 50;
const REBUY = { amount: 100, chips: 10000 };

test("o jogador ve a Mesa ao vivo acompanhar o admin sem recarregar", async ({ page, browser, isMobile }) => {
  test.slow();
  // O admin opera sempre em largura desktop, onde as Ações rápidas são a tabela
  // que os passos de `support/mesa.ts` conhecem, mesmo no projeto do iPhone.
  const adminContext = await browser.newContext({
    storageState: E2E_USERS.admin.storageState,
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  });
  const admin = await adminContext.newPage();
  const player = page;
  const [ana, bruno, carla, diego] = ["Ana", "Bruno", "Carla", "Diego"].map(uniqueName);
  let tournamentId = 0;

  try {
    await test.step("o admin monta um torneio Rodando com 4 buy-ins", async () => {
      for (const name of [ana, bruno, carla, diego]) await createPlayer(admin, name);
      tournamentId = await createTournament(admin, {
        name: uniqueName("Mesa E2E"),
        buyIn: BUY_IN,
        rebuy: REBUY,
        initialChips: 5000,
        rankingFee: 0,
      });
      await registerPlayers(admin, tournamentId, [ana, bruno, carla, diego]);
      for (const name of [ana, bruno, carla, diego]) await confirmBuyIn(admin, tournamentId, name);
      await startTournament(admin, tournamentId);
      await openMesa(admin, tournamentId);
    });

    await test.step("o jogador abre a Mesa ao vivo", async () => {
      await openMesa(player, tournamentId);
      await expectStatCard(player, "Jogadores", "4");
      await expectStatCard(player, "Fichas em jogo", "20.000");
      await expectStatCard(player, "Prize pool", new RegExp(brl(200)));
      // Some se a página do jogador recarregar ou navegar: conferido no fim.
      await player.evaluate(() => {
        (window as unknown as { semRecarregar?: boolean }).semRecarregar = true;
      });
    });

    await test.step("o Relogio inicia, pausa e retoma na tela do jogador", async () => {
      const playerRemaining = remainingTimer(player);
      const adminRemaining = remainingTimer(admin);
      const play = admin.getByRole("button", { name: "Iniciar", exact: true });
      const pause = admin.getByRole("button", { name: "Pausar", exact: true });

      // Antes do Iniciar a Mesa mostra 00:00; o Iniciar carrega os 15 minutos do
      // Nível 1 do padrão (ADR 0002: nenhum Fim do nível cabe no teste).
      await play.click();
      await expect(pause).toBeVisible(ACTION_TIMEOUT);
      await expect.poll(() => secondsLeft(playerRemaining), ACTION_TIMEOUT).toBeGreaterThan(14 * 60);
      await expectCountingDownFrom(playerRemaining, await secondsLeft(playerRemaining));

      await pause.click();
      await expect(play).toBeVisible(ACTION_TIMEOUT);
      const adminPaused = await expectStopped(adminRemaining);
      // O jogador para no mesmo Tempo restante que o admin: os dois leem o gravado.
      await expect.poll(() => secondsLeft(playerRemaining), ACTION_TIMEOUT).toBe(adminPaused);
      expect(await expectStopped(playerRemaining)).toBe(adminPaused);

      await play.click();
      await expect(pause).toBeVisible(ACTION_TIMEOUT);
      await expectCountingDownFrom(playerRemaining, adminPaused);
    });

    await test.step("a Eliminacao feita pelo admin tira um do card Jogadores", async () => {
      await eliminate(admin, diego);
      await expectStatCard(player, "Jogadores", "3", ACTION_TIMEOUT);
    });

    await test.step("o Rebuy aparece no detalhe de Jogadores e sobe Fichas em jogo e Prize pool", async () => {
      // Tocar no card abre a gaveta com o detalhe; ela fica aberta enquanto a
      // mesa se atualiza, e o Rebuy aparece nela sem recarregar.
      const players = await openPanel(player, "Jogadores", isMobile);
      await expect(players.getByText("3 em jogo · 4 com buy-in · 1 Eliminacao")).toBeVisible();
      await expect(players.getByRole("listitem").filter({ hasText: diego })).toContainText("4º");
      const anaRow = players.getByRole("listitem").filter({ hasText: ana });
      await expect(anaRow.getByText("Rebuy", { exact: true })).toBeHidden();

      await rebuy(admin, ana);
      await expect(anaRow.getByText("Rebuy", { exact: true })).toBeVisible(ACTION_TIMEOUT);
      await closePanel(player, players);

      // Quem recompra não sai de Em jogo: o card Jogadores segue em 3.
      await expectStatCard(player, "Jogadores", "3", ACTION_TIMEOUT);
      await expectStatCard(player, "Fichas em jogo", "30.000", ACTION_TIMEOUT);
      await expectStatCard(player, "Prize pool", new RegExp(brl(300)), ACTION_TIMEOUT);
    });

    await test.step("a mudanca na Estrutura de premios atualiza o Premio estimado", async () => {
      const prizePool = await openPanel(player, "Prize pool", isMobile);
      await expect(prizeRow(prizePool, 1, 45, 135)).toBeVisible();
      await expect(prizeRow(prizePool, 2, 25, 75)).toBeVisible();

      // 45/25 viram 55/15: o total segue 100% e o Salvar fica liberado.
      await openTournamentTab(admin, tournamentId, "Premios");
      await admin.getByRole("button", { name: "Editar Premios" }).click();
      const dialog = admin.getByRole("dialog", { name: "Editar estrutura de premios" });
      const percentages = dialog.getByRole("spinbutton");
      await percentages.nth(0).fill("55");
      await percentages.nth(1).fill("15");
      await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(dialog).toBeHidden(ACTION_TIMEOUT);

      await expect(prizeRow(prizePool, 1, 55, 165)).toBeVisible(ACTION_TIMEOUT);
      await expect(prizeRow(prizePool, 2, 15, 45)).toBeVisible();
    });

    await test.step("o jogador acompanhou tudo sem recarregar a pagina", async () => {
      expect(new URL(player.url()).pathname).toBe(`/torneios/${tournamentId}/mesa`);
      const stillThere = await player.evaluate(
        () => (window as unknown as { semRecarregar?: boolean }).semRecarregar
      );
      expect(stillThere).toBe(true);
    });
  } finally {
    await adminContext.close();
  }
});

// Abre a gaveta de um card da Mesa: tocando, no celular, onde ela sobe de baixo
// ocupando a largura; clicando, no desktop, onde ela abre na lateral direita.
async function openPanel(page: Page, label: string, isMobile: boolean) {
  const card = page.getByRole("button", { name: new RegExp(`^${label}: `) });
  if (isMobile) await card.tap();
  else await card.click();

  const drawer = page.getByRole("dialog", { name: label });
  await expect(drawer).toBeVisible();
  const viewport = page.viewportSize()!;
  // A gaveta anima a entrada: espera ela assentar na borda antes de conferir.
  await expect
    .poll(async () => {
      const box = await drawer.boundingBox();
      if (!box) return null;
      return isMobile
        ? { bottom: Math.round(box.y + box.height), width: Math.round(box.width) }
        : { right: Math.round(box.x + box.width), top: Math.round(box.y) };
    })
    .toEqual(
      isMobile
        ? { bottom: viewport.height, width: viewport.width }
        : { right: viewport.width, top: 0 }
    );
  return drawer;
}

async function closePanel(page: Page, drawer: Locator) {
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
}

// Linha da Estrutura de prêmios no painel Prize pool: posição, % e Prêmio estimado.
// A linha até onde paga também leva "paga ate aqui" depois da posição.
function prizeRow(drawer: Locator, position: number, percentage: number, prize: number) {
  return drawer.getByRole("row", {
    name: new RegExp(`^${position}º .*?${percentage}% ${brl(prize)}$`),
  });
}

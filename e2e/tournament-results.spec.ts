import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS } from "./support/users";
import { ACTION_TIMEOUT, eliminate, expectStatCard, mesaRow, openMesa, rebuy } from "./support/mesa";
import { brl, escapeRegExp } from "./support/text";
import {
  confirmBuyIn,
  createPlayer,
  createTournament,
  openTournamentTab,
  registerPlayers,
  startTournament,
  uniqueName,
} from "./support/tournament";

test.use({ storageState: E2E_USERS.admin.storageState });

// Valores redondos para conferir de cabeça: 5 buy-ins de R$ 50 e um Rebuy de
// R$ 50 dão Prize pool de R$ 300; o padrão de prêmios (45/25/15/10/5%) paga
// 135/75/45/30/15 e o de pontos dá 12/10/8/6/4.
const BUY_IN = 50;
const REBUY = { amount: 50, chips: 10000 };

type Result = { name: string; position: number; points: number; spent: number; prize: number };

test("admin elimina ate a Coroacao, distribui os premios, encerra e confere o Ranking", async ({ page }) => {
  test.slow();
  // Em ordem de Posição final: o primeiro é o campeão; o quarto faz o Rebuy.
  const [champion, second, third, fourth, fifth] = ["Ana", "Bruno", "Carla", "Diego", "Eva"].map(uniqueName);
  const results: Result[] = [
    { name: champion, position: 1, points: 12, spent: 50, prize: 135 },
    { name: second, position: 2, points: 10, spent: 50, prize: 75 },
    { name: third, position: 3, points: 8, spent: 50, prize: 45 },
    { name: fourth, position: 4, points: 6, spent: 100, prize: 30 },
    { name: fifth, position: 5, points: 4, spent: 50, prize: 15 },
  ];
  const seasonName = uniqueName("Temporada E2E");
  const tournamentName = uniqueName("Torneio E2E");
  let tournamentId = 0;

  await test.step("monta um torneio Rodando, numa temporada nova, com 5 buy-ins", async () => {
    for (const { name } of results) await createPlayer(page, name);
    tournamentId = await createTournament(page, {
      name: tournamentName,
      buyIn: BUY_IN,
      rebuy: REBUY,
      initialChips: 5000,
      rankingFee: 0,
      newSeason: seasonName,
    });
    await expect(page.getByText(seasonName, { exact: true })).toBeVisible();
    const names = results.map((r) => r.name);
    await registerPlayers(page, tournamentId, names);
    for (const name of names) await confirmBuyIn(page, tournamentId, name);
    await startTournament(page, tournamentId);
    await openMesa(page, tournamentId);

    await expectStatCard(page, "Jogadores", "5");
    await expectStatCard(page, "Fichas em jogo", "25.000");
    await expectStatCard(page, "Prize pool", new RegExp(brl(250)));
  });

  await test.step("a Eliminacao tira a Vitima de Em jogo com a Posicao final", async () => {
    await eliminate(page, fifth);
    await expectFinishPosition(page, fifth, "5º");
    await expectStatCard(page, "Jogadores", "4");
  });

  await test.step("o Rebuy de quem caiu sobe Fichas em jogo e Prize pool", async () => {
    await rebuy(page, fourth);
    // Quem recompra não sai de Em jogo ("Jogando" na tela).
    await expect(mesaRow(page, fourth).getByText("Jogando", { exact: true })).toBeVisible();
    await expectStatCard(page, "Jogadores", "4");
    await expectStatCard(page, "Fichas em jogo", "35.000");
    await expectStatCard(page, "Prize pool", new RegExp(brl(300)));
  });

  await test.step("elimina ate a Coroacao, que poe o campeao em 1º", async () => {
    for (const victim of [fourth, third, second]) {
      await eliminate(page, victim);
      const { position } = results.find((r) => r.name === victim)!;
      await expectFinishPosition(page, victim, `${position}º`);
    }
    await expectFinishPosition(page, champion, "🏆 1º");
    await expectStatCard(page, "Jogadores", "0");
  });

  await test.step("Distribuir premios registra o Premio de cada Posicao premiada", async () => {
    // Página nova: o dialog sugere quem leva cada Prêmio pelas Posições finais
    // que existiam quando ele montou.
    await openTournamentTab(page, tournamentId, "Premios");
    await page.getByRole("button", { name: "Distribuir premios" }).click();
    const dialog = page.getByRole("dialog", { name: "Distribuir premios" });
    await dialog.getByRole("button", { name: "Distribuir", exact: true }).click();
    await expect(dialog).toBeHidden(ACTION_TIMEOUT);

    for (const { name, position, prize } of results) {
      await expect(
        page.getByRole("row", {
          name: new RegExp(`^${position}º lugar ${escapeRegExp(name)} ${brl(prize)}$`),
        })
      ).toBeVisible();
    }
  });

  await test.step("encerra o torneio, que fica Encerrado", async () => {
    await page.getByRole("button", { name: "Encerrar torneio" }).click();
    const dialog = page.getByRole("dialog", { name: "Encerrar torneio" });
    await dialog.getByRole("button", { name: "Sim, encerrar" }).click();
    await expect(dialog).toBeHidden(ACTION_TIMEOUT);
    await expect(page.getByText("Encerrado", { exact: true })).toBeVisible();
  });

  await test.step("o Ranking da temporada mostra os pontos do torneio", async () => {
    await page.goto("/ranking");
    // A temporada recém-criada é a ativa, que o Ranking abre por padrão.
    await expect(page.getByText(seasonName, { exact: true })).toBeVisible();
    const rows = page.getByRole("row");
    for (const { name, position, points } of results) {
      // Linha 0 é o cabeçalho. Colunas: #, Jogador, Pts e os pontos do torneio;
      // do 1º ao 3º o # é um ícone, sem texto.
      await expect(rows.nth(position)).toHaveAccessibleName(
        new RegExp(`^(${position}° )?${escapeRegExp(name)} ${points} ${points}$`)
      );
    }
  });

  await test.step("pelo Ranking, o perfil de cada Participante mostra Posicao, pontos e Premio", async () => {
    // O Ranking não tem coluna de Prêmio: ele fica no perfil, aberto do Ranking.
    for (const { name, position, points, spent, prize } of results) {
      await page.goto("/ranking");
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
      // Colunas: Etapa (nome e data), Pos., Pts, Gastos e Premio.
      await expect(
        page.getByRole("row", {
          name: new RegExp(
            `^${escapeRegExp(tournamentName)} .* ${position}° ${points} ${brl(spent)} ${brl(prize)}$`
          ),
        })
      ).toBeVisible();
    }
  });
});

async function expectFinishPosition(page: Page, name: string, position: string) {
  await expect(mesaRow(page, name).getByText(position, { exact: true })).toBeVisible();
}

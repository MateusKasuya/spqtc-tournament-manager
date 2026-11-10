import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS } from "./support/users";
import { ACTION_TIMEOUT, eliminate, expectStatCard, mesaRow, openMesa, rebuy } from "./support/mesa";
import { brl, escapeRegExp } from "./support/text";
import {
  confirmBuyIn,
  createPlayer,
  createTournament,
  registerPlayers,
  startTournament,
  uniqueName,
} from "./support/tournament";

test.use({ storageState: E2E_USERS.admin.storageState });

// Valores redondos para conferir de cabeça: sem taxa de ranking, 50% do buy-in
// e do Rebuy de R$ 100 vira Bounty, então cada entrada arma R$ 50. Num Knockout
// com um Eliminador, metade do Bounty da Vítima vai em dinheiro para ele (Bounty
// coletado) e metade se soma ao Bounty dele.
const BUY_IN = 100;
const REBUY = { amount: 100, chips: 10000 };
const BOUNTY_PERCENTAGE = 50;

// O que a Mesa ao vivo deve mostrar de Bounty numa etapa, em reais.
type BountyState = {
  // Bounty de cada Participante Em jogo; quem não está aqui saiu (ou é o campeão).
  inPlay: Record<string, number>;
  // Bounty coletado; quem não está aqui não coletou nada.
  collected: Record<string, number>;
  bountyAllocated: number;
  champion?: string;
};

test("admin roda um Bounty Builder: Eliminacao, Rebuy, Desfazer e Coroacao movem o Bounty", async ({ page }) => {
  test.slow();
  const [ana, bruno, carla, diego] = ["Ana", "Bruno", "Carla", "Diego"].map(uniqueName);
  const everyone = [ana, bruno, carla, diego];
  let tournamentId = 0;

  await test.step("monta um Bounty Builder Rodando com 4 buy-ins, cada um com Bounty de R$ 50", async () => {
    for (const name of everyone) await createPlayer(page, name);
    tournamentId = await createTournament(page, {
      name: uniqueName("Bounty Builder E2E"),
      buyIn: BUY_IN,
      rebuy: REBUY,
      initialChips: 5000,
      rankingFee: 0,
      bountyBuilder: { percentage: BOUNTY_PERCENTAGE },
    });
    await registerPlayers(page, tournamentId, everyone);
    for (const name of everyone) await confirmBuyIn(page, tournamentId, name);
    await startTournament(page, tournamentId);
    await openMesa(page, tournamentId);

    // Arrecadado R$ 400, Bounty armado R$ 200: o Prize pool fica com o resto.
    await expectStatCard(page, "Prize pool", new RegExp(brl(200)));
    await expectBounty(page, everyone, {
      inPlay: { [ana]: 50, [bruno]: 50, [carla]: 50, [diego]: 50 },
      collected: {},
      bountyAllocated: 200,
    });
  });

  // Ana derruba Diego: coleta R$ 25 e o Bounty dela vai a R$ 75.
  const afterFirstElimination: BountyState = {
    inPlay: { [ana]: 75, [bruno]: 50, [carla]: 50 },
    collected: { [ana]: 25 },
    bountyAllocated: 200,
  };

  await test.step("a Eliminacao passa o Bounty da Vitima ao Eliminador e o Bounty em jogo cai", async () => {
    await eliminate(page, diego, { eliminators: [ana] });
    await expectStatus(page, diego, "4º");
    await expectBounty(page, everyone, afterFirstElimination);
  });

  // Bruno derruba Carla, que recompra: Bruno coleta R$ 25 e vai a R$ 75; Carla
  // volta com um Bounty novo de R$ 50, que entra no Bounty armado.
  const afterRebuy: BountyState = {
    inPlay: { [ana]: 75, [bruno]: 75, [carla]: 50 },
    collected: { [ana]: 25, [bruno]: 25 },
    bountyAllocated: 250,
  };

  await test.step("o Rebuy volta com Bounty novo e o Bounty em jogo sobe", async () => {
    await rebuy(page, carla, { eliminators: [bruno] });
    await expectStatus(page, carla, "Jogando");
    // Arrecadado R$ 500, Bounty armado R$ 250.
    await expectStatCard(page, "Prize pool", new RegExp(brl(250)));
    await expectBounty(page, everyone, afterRebuy);
  });

  await test.step("Desfazer a Eliminacao devolve Bounty, Posicao final e Em jogo", async () => {
    await eliminate(page, carla, { eliminators: [ana] });
    await expectStatus(page, carla, "3º");
    await expectBounty(page, everyone, {
      inPlay: { [ana]: 100, [bruno]: 75 },
      collected: { [ana]: 50, [bruno]: 25 },
      bountyAllocated: 250,
    });

    await undoElimination(page, carla);
    await expectStatus(page, carla, "Jogando");
    await expectStatus(page, diego, "4º");
    await expectBounty(page, everyone, afterRebuy);
  });

  await test.step("a Coroacao da ao campeao o proprio Bounty e zera o Bounty em jogo", async () => {
    // Bruno derruba Carla (R$ 50) e vai a R$ 100; Ana derruba Bruno (R$ 100),
    // vai a R$ 125 e, sozinha em jogo, coleta o próprio Bounty na Coroação.
    await eliminate(page, carla, { eliminators: [bruno] });
    await expectStatus(page, carla, "3º");
    await eliminate(page, bruno, { eliminators: [ana] });
    await expectStatus(page, bruno, "2º");
    await expectStatus(page, ana, "🏆 1º");
    await expectBounty(page, everyone, {
      inPlay: {},
      // Ana: 25 (Diego) + 50 (Bruno) + 125 (o próprio Bounty).
      collected: { [ana]: 200, [bruno]: 50 },
      bountyAllocated: 250,
      champion: ana,
    });
  });
});

// Coluna Status das Ações rápidas: "Jogando" (Em jogo), a Posição final de quem
// caiu ou o troféu do campeão.
async function expectStatus(page: Page, name: string, status: string) {
  await expect(mesaRow(page, name).getByText(status, { exact: true })).toBeVisible(ACTION_TIMEOUT);
}

async function undoElimination(page: Page, name: string) {
  const row = mesaRow(page, name);
  await row.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(row.getByRole("button", { name: "Eliminar", exact: true })).toBeVisible(ACTION_TIMEOUT);
}

// Bounty em jogo em três lugares que precisam bater: o card, as colunas Bounty
// e Faturado (Bounty coletado) das Ações rápidas e a gaveta do card.
async function expectBounty(page: Page, everyone: string[], state: BountyState) {
  const bountyInPlay = Object.values(state.inPlay).reduce((sum, v) => sum + v, 0);
  const collectedTotal = Object.values(state.collected).reduce((sum, v) => sum + v, 0);
  // Conservação: o que o teste espera precisa fechar antes de conferir a tela.
  expect(bountyInPlay + collectedTotal, "Bounty em jogo + coletados = Bounty armado").toBe(state.bountyAllocated);

  await expectStatCard(page, "Bounty em jogo", new RegExp(brl(bountyInPlay)));

  const bountyColumn = await columnIndex(page, "Bounty");
  const collectedColumn = await columnIndex(page, "Faturado");
  for (const name of everyone) {
    const cells = mesaRow(page, name).getByRole("cell");
    const bounty = state.inPlay[name];
    // Fora de Em jogo, a coluna Bounty mostra um traço.
    await expect(cells.nth(bountyColumn)).toHaveText(bounty === undefined ? "—" : new RegExp(`^${brl(bounty)}$`));
    await expect(cells.nth(collectedColumn)).toHaveText(new RegExp(`^${brl(state.collected[name] ?? 0)}$`));
  }

  await page.getByRole("button", { name: /^Bounty em jogo: / }).click();
  const drawer = page.getByRole("dialog", { name: "Bounty em jogo" });
  await expect(drawer).toBeVisible();

  const inPlayList = drawer.getByRole("list", { name: "Bounty de cada Participante em jogo" });
  const inPlay = Object.entries(state.inPlay);
  if (inPlay.length === 0) {
    await expect(drawer.getByText("Ninguem em jogo.", { exact: true })).toBeVisible();
  } else {
    await expect(inPlayList.getByRole("listitem")).toHaveCount(inPlay.length);
    // O item começa pelo nome e pelo Bounty; depois vem o "derrubar sozinho".
    for (const [name, bounty] of inPlay) {
      await expect(inPlayList.getByRole("listitem").filter({ hasText: name })).toHaveText(
        new RegExp(`^${escapeRegExp(name)}\\s*${brl(bounty)}`)
      );
    }
  }

  const collectedList = drawer.getByRole("list", { name: "Bounty coletado" });
  const collected = Object.entries(state.collected);
  if (collected.length === 0) {
    await expect(drawer.getByText("Ninguem coletou Bounty ainda.", { exact: true })).toBeVisible();
  } else {
    await expect(collectedList.getByRole("listitem")).toHaveCount(collected.length);
    for (const [name, amount] of collected) {
      const item = collectedList.getByRole("listitem").filter({ hasText: name });
      await expect(item).toHaveText(new RegExp(`^${escapeRegExp(name)}\\s*${brl(amount)}`));
      const championNote = item.getByText("Campeao: inclui o proprio Bounty coletado na Coroacao", { exact: true });
      if (name === state.champion) await expect(championNote).toBeVisible();
      else await expect(championNote).toBeHidden();
    }
  }

  for (const [label, amount] of [
    ["Bounty em jogo", bountyInPlay],
    ["Bounties coletados", collectedTotal],
    ["Bounty armado", state.bountyAllocated],
  ] as const) {
    await expect(drawer.getByRole("row", { name: new RegExp(`^${label} ${brl(amount)}$`) })).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
}

// Posição da coluna no cabeçalho das Ações rápidas: as colunas de Rebuy, add-on
// e bônus só aparecem quando o torneio as permite.
async function columnIndex(page: Page, header: string) {
  const quickActions = page
    .getByRole("table")
    .filter({ has: page.getByRole("columnheader", { name: "Faturado", exact: true }) });
  const headers = await quickActions.getByRole("columnheader").allTextContents();
  const index = headers.findIndex((text) => text.trim() === header);
  expect(index, `coluna ${header} nas Acoes rapidas`).toBeGreaterThanOrEqual(0);
  return index;
}

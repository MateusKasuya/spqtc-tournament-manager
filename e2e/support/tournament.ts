// Passos de montar um torneio pela UI, reaproveitados pelas jornadas do e2e.
import { expect, type Page } from "@playwright/test";

// O setup zera o banco só uma vez por run: nomes únicos evitam que um teste
// encontre os dados de outro.
export function uniqueName(prefix: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix} ${suffix}`;
}

export async function createPlayer(page: Page, name: string) {
  await page.goto("/jogadores");
  await page.getByRole("button", { name: "Novo Jogador" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo Jogador" });
  await dialog.getByLabel("Nome", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export type NewTournament = {
  name: string;
  // Valores em reais, como o admin digita.
  buyIn: number;
  initialChips: number;
  rankingFee: number;
};

// Torneio Normal, sem temporada; blinds e prêmios nascem com o padrão do app.
export async function createTournament(page: Page, tournament: NewTournament) {
  await page.goto("/torneios/novo");
  await page.getByLabel("Nome do torneio", { exact: true }).fill(tournament.name);
  await page.getByLabel("Fichas iniciais", { exact: true }).fill(String(tournament.initialChips));
  await page.getByLabel("Buy-in (R$)", { exact: true }).fill(tournament.buyIn.toFixed(2));
  await page.getByLabel("Taxa de ranking por buy-in (R$)", { exact: true }).fill(tournament.rankingFee.toFixed(2));
  await page.getByRole("button", { name: "Criar torneio" }).click();

  await page.waitForURL(/\/torneios\/\d+$/);
  await expect(page.getByRole("heading", { name: tournament.name })).toBeVisible();
  return Number(new URL(page.url()).pathname.split("/").pop());
}

export async function openTournamentTab(
  page: Page,
  tournamentId: number,
  tab: "Visao Geral" | "Jogadores" | "Blinds" | "Premios"
) {
  if (new URL(page.url()).pathname !== `/torneios/${tournamentId}`) {
    await page.goto(`/torneios/${tournamentId}`);
  }
  // A aba Jogadores leva a contagem de inscritos no nome ("Jogadores2").
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
}

export function participantRow(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Participantes" })
    .getByRole("listitem", { name, exact: true });
}

export async function registerPlayers(page: Page, tournamentId: number, names: string[]) {
  await openTournamentTab(page, tournamentId, "Jogadores");
  await page.getByRole("button", { name: "Adicionar jogador" }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar jogadores" });
  // A lista traz todos os Jogadores do banco: filtra pelo nome antes de marcar.
  const search = dialog.getByPlaceholder("Buscar jogador...");
  for (const name of names) {
    await search.fill(name);
    await dialog.getByText(name, { exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(dialog).toBeHidden();
  for (const name of names) {
    await expect(participantRow(page, name)).toBeVisible();
  }
}

export async function confirmBuyIn(page: Page, tournamentId: number, name: string) {
  await openTournamentTab(page, tournamentId, "Jogadores");
  const row = participantRow(page, name);
  const confirm = row.getByRole("button", { name: "Confirmar buy-in" });
  await confirm.click();
  await expect(confirm).toBeHidden();
}

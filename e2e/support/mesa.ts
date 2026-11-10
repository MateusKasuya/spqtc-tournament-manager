// Passos do admin na Mesa ao vivo (Eliminação e Rebuy), reaproveitados pelas
// jornadas do e2e. Os passos não navegam: quem chama abre a Mesa antes, na
// página (ou no contexto de navegador) que quiser.
import { expect, type Page } from "@playwright/test";
import { escapeRegExp } from "./text";

// A troca da linha espera a action e o refresh; o build de produção do CI pode
// passar do timeout padrão.
export const ACTION_TIMEOUT = { timeout: 15_000 };

export async function openMesa(page: Page, tournamentId: number) {
  await page.goto(`/torneios/${tournamentId}/mesa`);
  await expect(page.getByRole("timer", { name: "Tempo restante" })).toBeVisible();
}

// Linha do Participante nas Ações rápidas, pelo nome exibido (apelido, se houver).
// Só em largura desktop: lá elas são uma tabela; os cards do celular ficam
// escondidos e não são `row`.
export function mesaRow(page: Page, name: string) {
  return page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
}

// Card da Mesa ao vivo (Jogadores, Fichas em jogo, Prize pool...). Com detalhe
// para abrir, o card é um botão cujo nome é "<rótulo>: <número>. Ver detalhes".
// Quem só assiste espera o realtime: passe `ACTION_TIMEOUT` em `options`.
export async function expectStatCard(
  page: Page,
  label: string,
  value: string | RegExp,
  options: { timeout?: number } = {}
) {
  const card = page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}: `) });
  const shown = typeof value === "string" ? escapeRegExp(value) : value.source;
  await expect(card).toHaveAccessibleName(new RegExp(`^${escapeRegExp(label)}: ${shown}\\. Ver detalhes$`), options);
}

export type KnockoutOptions = {
  // Bounty Builder pergunta "Quem eliminou?" antes de registrar e exige ao
  // menos um; no Normal não há Eliminador e a lista fica vazia.
  eliminators?: string[];
};

export async function eliminate(page: Page, name: string, options: KnockoutOptions = {}) {
  const row = mesaRow(page, name);
  const button = row.getByRole("button", { name: "Eliminar", exact: true });
  await button.click();
  await chooseEliminators(page, "Eliminar", options.eliminators, async () => !(await button.isVisible()));
  await expect(button).toBeHidden(ACTION_TIMEOUT);
}

// O Rebuy não tira a linha de Em jogo: o sinal de que entrou é a linha mudar.
export async function rebuy(page: Page, name: string, options: KnockoutOptions = {}) {
  const row = mesaRow(page, name);
  const before = (await row.textContent()) ?? "";
  await row.getByRole("button", { name: "Rebuy", exact: true }).click();
  await chooseEliminators(page, "Rebuy", options.eliminators, async () => (await row.textContent()) !== before);
  await expect(row).not.toHaveText(before, ACTION_TIMEOUT);
}

async function chooseEliminators(
  page: Page,
  actionLabel: string,
  eliminators: string[] = [],
  applied: () => Promise<boolean>
) {
  const dialog = page.getByRole("dialog", { name: "Quem eliminou?" });
  if (eliminators.length === 0) {
    // Sem Eliminadores, o passo só vale fora de Bounty Builder: falha aqui, com
    // a causa, em vez de estourar o timeout esperando a linha mudar.
    await expect
      .poll(async () => (await dialog.isVisible()) || (await applied()), ACTION_TIMEOUT)
      .toBe(true);
    await expect(dialog, "Bounty Builder pede os Eliminadores: passe `eliminators`").toBeHidden();
    return;
  }
  // O rótulo do Eliminador também leva o Bounty dele ("Ana Bounty: R$ ..."):
  // casa por substring, que o sufixo único dos nomes já torna inequívoca.
  for (const name of eliminators) await dialog.getByLabel(name).check();
  await dialog.getByRole("button", { name: actionLabel, exact: true }).click();
  await expect(dialog).toBeHidden();
}

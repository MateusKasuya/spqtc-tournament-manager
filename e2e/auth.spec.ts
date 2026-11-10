import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS } from "./support/users";

// Sem storageState: cada teste começa deslogado.

test("pagina interna sem sessao leva ao login", async ({ page }) => {
  await page.goto("/torneios");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("senha errada mostra a mensagem de erro e continua no login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USERS.player.email);
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Email ou senha incorretos")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("cadastro cria a conta e o perfil e entra como jogador", async ({ page }) => {
  const localPart = await signUpNewUser(page);

  // O nome vem do trigger handle_new_user: sem metadata, a parte antes do @.
  await expect(page.getByRole("heading", { name: `Ola, ${localPart}!` })).toBeVisible();
  await expect(page.getByText("Jogador", { exact: true })).toBeVisible();
});

// Usuário próprio: o signOut do Supabase revoga todas as sessões do usuário, e
// sair com o admin ou o jogador do setup invalidaria as sessões salvas deles.
test("logout volta ao login e a pagina interna volta a exigir login", async ({ page }) => {
  await signUpNewUser(page);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

async function signUpNewUser(page: Page) {
  const localPart = `novo-${Date.now()}`;
  await page.goto("/login");
  await page.getByRole("link", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);

  await page.getByLabel("Email").fill(`${localPart}@e2e.test`);
  await page.getByLabel("Senha").fill("senha-e2e-novo");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  return localPart;
}

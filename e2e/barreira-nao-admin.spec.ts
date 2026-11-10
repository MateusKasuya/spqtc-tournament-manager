import { expect, test, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { localSupabase } from "./support/local-supabase";
import { E2E_USERS } from "./support/users";

// O jogador vê o torneio e a Mesa ao vivo, mas nenhum controle de admin. O mesmo
// passeio com o admin prova que os seletores acham os controles quando existem:
// sem ele, um nome errado de botão passaria calado no lado do jogador.

type Fixture = { id: number; name: string; registeredName: string; playingName: string };

let fixture: Fixture;

test.beforeAll(async () => {
  fixture = await createRunningTournament();
});

test.describe("jogador", () => {
  test.use({ storageState: E2E_USERS.player.storageState });

  test("ve o torneio e a Mesa ao vivo sem controles de admin", async ({ page }) => {
    await walkTournament(page, "ausentes");
  });
});

test.describe("admin (controle dos seletores)", () => {
  test.use({ storageState: E2E_USERS.admin.storageState });

  test("ve os controles de admin nas mesmas paginas", async ({ page }) => {
    await walkTournament(page, "visiveis");
  });
});

type Expectation = "visiveis" | "ausentes";

async function expectControls(expectation: Expectation, controls: Locator[]) {
  for (const control of controls) {
    if (expectation === "visiveis") await expect(control).toBeVisible();
    else await expect(control).toHaveCount(0);
  }
}

// Cada página primeiro mostra um conteúdo que todos veem, e só então confere os
// controles de admin, para a ausência não passar com a página ainda carregando.
async function walkTournament(page: Page, adminControls: Expectation) {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Ola, / })).toBeVisible();
  await expectControls(adminControls, [page.getByRole("link", { name: "Criar Torneio" })]);

  await page.goto("/torneios");
  await expect(page.getByRole("heading", { name: "Torneios" })).toBeVisible();
  await expectControls(adminControls, [page.getByRole("link", { name: "Novo Torneio" })]);
  await page.getByRole("link", { name: fixture.name }).click();

  await expect(page).toHaveURL(new RegExp(`/torneios/${fixture.id}$`));
  await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();
  await expectControls(adminControls, [
    page.getByRole("link", { name: "Editar" }),
    page.getByRole("button", { name: "Encerrar torneio" }),
    page.getByRole("button", { name: "Cancelar torneio" }),
  ]);

  // O conteúdo de uma aba só existe com ela aberta.
  await page.getByRole("tab", { name: /^Jogadores/ }).click();
  await expect(page.getByText(fixture.registeredName)).toBeVisible();
  await expect(page.getByText(fixture.playingName)).toBeVisible();
  await expectControls(adminControls, [
    page.getByRole("button", { name: "Confirmar buy-in" }),
    page.getByRole("button", { name: "Eliminar", exact: true }),
  ]);

  await page.getByRole("tab", { name: "Premios" }).click();
  await expect(page.getByRole("heading", { name: "Estrutura de premios" })).toBeVisible();
  await expectControls(adminControls, [page.getByRole("button", { name: "Distribuir premios" })]);

  await page.getByRole("link", { name: "Mesa ao Vivo" }).click();
  await expect(page).toHaveURL(new RegExp(`/torneios/${fixture.id}/mesa$`));
  await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Abrir painel Nivel/ })).toBeVisible();
  await expectControls(adminControls, [
    page.getByRole("button", { name: "Iniciar", exact: true }),
    page.getByRole("button", { name: "Encerrar", exact: true }),
  ]);
}

// Torneio rodando com um nível de blind e dois participantes: um inscrito sem
// buy-in (o admin veria "Confirmar buy-in") e um jogando (o admin veria
// "Eliminar"). Direto no banco, sem depender de outro teste.
async function createRunningTournament(): Promise<Fixture> {
  const suffix = Date.now();
  const names = {
    name: `Barreira E2E ${suffix}`,
    registeredName: `Inscrito E2E ${suffix}`,
    playingName: `Jogando E2E ${suffix}`,
  };
  const sql = postgres(localSupabase().appEnv.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const [admin] = await sql`SELECT id FROM public.users WHERE email = ${E2E_USERS.admin.email}`;
    if (!admin) throw new Error("Admin do setup nao encontrado em public.users.");

    const [tournament] = await sql`
      INSERT INTO public.tournaments (name, date, status, buy_in_amount, initial_chips, created_by)
      VALUES (${names.name}, now(), 'running', 50, 10000, ${admin.id})
      RETURNING id`;
    await sql`
      INSERT INTO public.blind_structures (tournament_id, level, small_blind, big_blind, duration_minutes)
      VALUES (${tournament.id}, 1, 25, 50, 20)`;

    const [registered] = await sql`
      INSERT INTO public.players (name) VALUES (${names.registeredName}) RETURNING id`;
    const [playing] = await sql`
      INSERT INTO public.players (name) VALUES (${names.playingName}) RETURNING id`;
    await sql`
      INSERT INTO public.participants (tournament_id, player_id, buy_in_paid, status)
      VALUES
        (${tournament.id}, ${registered.id}, false, 'registered'),
        (${tournament.id}, ${playing.id}, true, 'playing')`;

    return { id: tournament.id as number, ...names };
  } finally {
    await sql.end();
  }
}

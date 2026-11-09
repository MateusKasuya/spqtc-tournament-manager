import { expect, test as setup, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { localSupabase } from "./support/local-supabase";
import { E2E_USERS } from "./support/users";

type E2EUser = (typeof E2E_USERS)[keyof typeof E2E_USERS];

// Infraestrutura, não asserção: zera o Supabase local e prepara os usuários de
// teste. Roda uma vez por run, antes de qualquer teste (projeto "setup").
setup("zera o banco, cria admin e jogador e salva as sessoes", async ({ browser }) => {
  const { appEnv, serviceRoleKey } = localSupabase();
  const sql = postgres(appEnv.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await sql`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
        END LOOP;
      END $$`;
    await sql`DELETE FROM auth.users`;

    const supabase = createClient(appEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const user of Object.values(E2E_USERS)) {
      const { error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name },
      });
      if (error) throw new Error(`Falha ao criar ${user.email}: ${error.message}`);
    }

    // O perfil vem do trigger on_auth_user_created; só o papel muda aqui.
    const promoted = await sql`
      UPDATE public.users SET role = 'admin' WHERE email = ${E2E_USERS.admin.email} RETURNING id`;
    if (promoted.length !== 1) {
      throw new Error("Perfil do admin nao foi criado pelo trigger on_auth_user_created.");
    }
  } finally {
    await sql.end();
  }

  for (const user of Object.values(E2E_USERS)) {
    await loginAndSaveSession(browser, user);
  }
});

async function loginAndSaveSession(browser: Browser, user: E2EUser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await context.storageState({ path: user.storageState });
  await context.close();
}

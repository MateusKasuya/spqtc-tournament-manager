import { expect, test } from "@playwright/test";
import { E2E_USERS } from "./support/users";

test.use({ storageState: E2E_USERS.admin.storageState });

test("admin logado abre o app e ve o dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: `Ola, ${E2E_USERS.admin.name}!` })
  ).toBeVisible();
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
});

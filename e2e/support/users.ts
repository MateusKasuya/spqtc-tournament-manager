// Usuários de teste criados pelo setup a cada run (e2e/global.setup.ts).
export const E2E_USERS = {
  admin: {
    name: "Admin E2E",
    email: "admin@e2e.test",
    password: "senha-e2e-admin",
    storageState: "e2e/.auth/admin.json",
  },
  jogador: {
    name: "Jogador E2E",
    email: "jogador@e2e.test",
    password: "senha-e2e-jogador",
    storageState: "e2e/.auth/jogador.json",
  },
} as const;

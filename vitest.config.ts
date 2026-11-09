import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    // e2e é do Playwright (`pnpm e2e`) e precisa do Supabase local.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});

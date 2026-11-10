import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Testes ficam fora do lint (padrões comuns de teste, como any em casts de
  // resultado de query); continuam cobertos por tsc (typecheck) e vitest.
  globalIgnores([
    "**/*.test.ts",
    "**/*.test.tsx",
    "src/test/**",
    ".next/**",
    ".claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

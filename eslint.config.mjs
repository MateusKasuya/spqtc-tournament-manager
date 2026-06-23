import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Arquivos de teste não fazem parte do build de produção; o `next build`
    // roda ESLint e falharia em padrões comuns de teste (ex.: any em casts de
    // resultado de query). Continuam cobertos por tsc (typecheck) e vitest.
    ignores: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"],
  },
];

export default eslintConfig;

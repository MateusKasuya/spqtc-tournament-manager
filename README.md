This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testes e2e (Playwright + Supabase local)

Os e2e abrem o app num navegador real contra um Supabase local em Docker (ver `docs/adr/0003-e2e-contra-supabase-local.md`). Nada aponta para produção: as variáveis vêm do `supabase status`, nunca do `.env.local`, e o setup recusa rodar se a URL do banco ou da API não for local.

Pré-requisitos: Docker rodando e o [CLI do Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) instalado (`brew install supabase/tap/supabase`). Na primeira vez, instale o navegador: `pnpm exec playwright install chromium`.

```bash
pnpm supabase:start   # sobe banco, Auth, PostgREST e Realtime (config em supabase/config.toml)
pnpm e2e:migrate      # pnpm db:migrate contra o Supabase local, da baseline à última migration
pnpm e2e              # roda os testes; sobe o `next dev` na porta 3100 se não houver um rodando
```

- Para não esperar o servidor a cada run, deixe `pnpm e2e:dev` rodando num terminal (`next dev` na 3100 apontado para o Supabase local); o `pnpm e2e` reaproveita. Um `pnpm dev` comum (porta 3000, `.env.local`) nunca é reaproveitado.
- Cada run zera as tabelas `public` e os usuários do Auth e cria um admin e um jogador de teste (`e2e/support/users.ts`).
- Falhas guardam trace, screenshot e vídeo em `test-results/`; abra com `pnpm exec playwright show-trace <arquivo>.zip`.
- `pnpm supabase:stop` derruba os containers. `pnpm test` (Vitest) ignora a pasta `e2e/` e não precisa de Docker.

No CI, o job `e2e` faz o mesmo com `next build` + `next start` e sobe o relatório como artefato quando algo falha.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

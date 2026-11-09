---
status: accepted
date: 2026-11-09
---

# E2E contra Supabase local, com a configuração do Supabase versionada como migration Drizzle

Os testes e2e (Playwright) rodam contra um Supabase local (CLI do Supabase em Docker), tanto na máquina quanto no CI, e o banco local recebe o schema pelo mesmo `pnpm db:migrate` de produção. O que antes vivia só no painel do Supabase de produção (o trigger `on_auth_user_created` → `handle_new_user()`, que cria a linha em `public.users`, e a publicação de realtime das tabelas da Mesa ao vivo) passa a ser migration Drizzle idempotente, no-op fora do Supabase, como a `0004_realtime_blind_structures`. Escolhemos assim porque o app depende de Auth, PostgREST (leitura do perfil e do `role`) e Realtime do Supabase em todo request, o que um Postgres puro ou o pglite dos testes de integração não reproduzem, e porque a configuração fora do repo já tinha divergido de produção sem ninguém perceber (a `0005` não aplicada, RLS desligado).

## Considered Options

- **Projeto Supabase hospedado só para teste**: mais simples de subir, mas compartilhado entre runs (estado vaza), exige secrets no CI e continua com configuração fora do repo. Rejeitada.
- **Mockar o Supabase no navegador**: perde justamente auth, RLS e realtime, que é o que mais quebra. Rejeitada.
- **Supabase local + configuração versionada em migration Drizzle** (escolhida). Alternativa descartada dentro dela: versionar a configuração em `supabase/migrations`, o que criaria duas fontes de schema.

## Consequences

- O Drizzle continua sendo a única fonte do schema; `supabase/config.toml` só configura os serviços locais.
- Toda mudança de configuração do Supabase (trigger, publicação, RLS, policies) entra por migration, e o e2e passa a pegar quando ela quebra login, ações de admin ou o realtime.
- O CI ganha Docker e alguns minutos para subir o Supabase local no job de e2e.

---
status: accepted
date: 2026-11-12
---

# Migrations de produção rodam no build da Vercel, e toda migration é retrocompatível

O banco de produção só recebe migration pelo deploy de Production da `main` na Vercel: o build roda `next build` e, se ele passar, um script de deploy aplica as migrations pendentes e confere o banco antes da promoção. Se a migration ou a conferência falhar, o build falha e a versão anterior continua no ar. Escolhemos assim porque a `0005_realtime_prize_structures` ficou de 2026-11-06 a 2026-11-09 sem chegar em produção (#131): nada rodava `db:migrate` no deploy, e o deploy passava normalmente com o schema atrasado. Como a migration roda antes de o código novo entrar no ar, e o Instant Rollback da Vercel volta o código sem voltar o schema, toda migration precisa funcionar com o código que já está no ar (expand/contract).

## Decisões

- **Onde e quando**: `vercel.json` versionado com `buildCommand` = `pnpm build && pnpm db:migrate:deploy`. Build primeiro: o `next build` não lê o banco (o job `verify` do CI builda sem `DATABASE_URL`), então um erro de compilação derruba o deploy antes de tocar no schema.
- **Só a `main` em Production migra**: o script só migra com `VERCEL_ENV=production` e `VERCEL_GIT_COMMIT_REF=main`. Em Preview e em dev ele não faz nada; em Production com outra ref ele falha. Promover um deploy de Preview para Production não é suportado, porque o build seria refeito com as variáveis de Production e aplicaria a migration de uma branch não mergeada. A documentação da Vercel confirma o rebuild ("Promoting a preview deployment to production triggers a complete rebuild with production environment variables"); ela não diz que valor a `VERCEL_GIT_COMMIT_REF` tem nesse rebuild, e a trava por ref falha o deploy em qualquer valor diferente de `main`. Instant Rollback e promover um deploy de Production que já existe não refazem o build, então não migram. As duas variáveis são System Environment Variables da Vercel e dependem da opção "Automatically expose System Environment Variables" ligada no projeto: sem ela, a `VERCEL_ENV` chega vazia e o deploy de Production pularia a migration (o log do build diz `VERCEL_ENV=(indefinida)`).
- **Conexão**: `MIGRATION_DATABASE_URL`, com a URL do pooler de sessão do Supabase (`*.pooler.supabase.com:5432`), definida só no ambiente Production da Vercel. O app continua usando a `DATABASE_URL` do pooler de transação. A conexão direta não serve porque só tem IPv6 sem o add-on pago, e o build da Vercel é IPv4. Em Production sem `MIGRATION_DATABASE_URL`, o script falha; não cai para a `DATABASE_URL`. O `drizzle.config.ts` e o `pnpm db:migrate` local ficam como estão.
- **Trava**: o script pega um `pg_advisory_lock` e chama o `migrate()` do drizzle-orm na mesma conexão, para que dois deploys seguidos não apliquem a mesma migration ao mesmo tempo. Não usa o CLI `drizzle-kit migrate`.
- **Conferência**: depois de migrar, o script faz as mesmas verificações do `pnpm db:check`, pela mesma `MIGRATION_DATABASE_URL`, e falha o deploy se houver migration do journal não aplicada (inclusive a pulada pelo critério de `when` do Drizzle), tabela de `public` sem RLS, tabela da Mesa ao vivo fora da publicação `supabase_realtime` ou falta do trigger `on_auth_user_created`, ou se não conseguir checar. Banco com mais migrations que o journal só é reportado: é o caso de um Redeploy de commit antigo, que o expand/contract torna seguro. O `pnpm db:check` manual continua falhando nesse caso.
- **Aviso**: deploy com falha já manda email para o dono do projeto na Vercel e deixa vermelho o status do commit na `main`. Nada além disso.
- **Produção só migra pelo deploy**: ninguém roda `pnpm db:migrate` contra produção à mão, e migration que falha no deploy é corrigida por PR, não por SQL no painel. `pnpm db:check` contra produção continua livre (é só leitura).
- **Expand/contract por convenção**: remover ou renomear coluna ou tabela, mudar tipo e ligar `NOT NULL` sem default viram dois deploys: primeiro o código para de depender do que vai mudar, depois entra a migration destrutiva. Cobrado no review via `CODING_STANDARDS.md`, sem check automático (o volume é de poucas migrations por ano).

## Considered Options

- **Job do GitHub Actions após o push na `main`**: roda em paralelo com o deploy da Vercel, que publica a `main` sem esperar nada, então o código novo pode entrar no ar antes do schema. Evitar isso exigiria desligar o deploy automático e disparar a Vercel por Deploy Hook, além de pôr um secret de produção no GitHub, que hoje não tem nenhum. Rejeitada.
- **Continuar manual, com `pnpm db:check` como lembrete**: foi o que deixou a `0005` três dias fora. Rejeitada.
- **Build da Vercel só em Production** (escolhida).

## Consequences

- Ajuste ao ADR 0003: ele diz que o banco local do e2e recebe o schema "pelo mesmo `pnpm db:migrate` de produção". Produção passa a migrar pelo script de deploy, não pelo CLI. Os dois continuam aplicando a mesma pasta `drizzle/migrations` e registrando na mesma tabela `drizzle.__drizzle_migrations`, que o `db:check` lê; o script de deploy precisa manter essa tabela e esse schema.
- O CI cobre esse caminho sobre postgres-js (#170): o job `e2e` aplica as migrations do zero no Supabase local pelo `pnpm e2e:migrate:deploy`, que roda o `pnpm db:migrate:deploy` com as variáveis de Production apontadas para o banco local. Isso substitui, no CI, o "mesmo `pnpm db:migrate` de produção" do ADR 0003; o `pnpm e2e:migrate` (drizzle-kit) continua para uso local. Os testes do Vitest cobrem a mesma regra sobre pglite.
- O script chama o migrate do drizzle-orm pela classe `PgDialect` com a sessão em `db._.session`, para servir postgres-js e pglite. Os dois estão nos tipos públicos do drizzle-orm 0.45, mas não na documentação. O `migrate()` de cada driver faz a mesma chamada pelos campos `@internal` do banco, então trocar não tiraria a dependência. Ao atualizar o drizzle-orm, confira essa chamada em `src/db/deploy-migrations.ts`. Uma quebra que afete só o postgres-js passa no Vitest, que roda sobre pglite; quem a pega é o job `e2e`.
- Um PR com migration roda no Preview contra o schema antigo, porque Preview nunca migra. O e2e contra o Supabase local é quem cobre o schema novo.
- Um drift feito à mão no painel do Supabase (RLS desligado, tabela fora da publicação) bloqueia todo deploy até ser corrigido por migration.
- Se duas branches gerarem migration com o mesmo número, quem mergeia por último apaga a sua e roda `pnpm db:generate` de novo em cima da `main`. Renomear o arquivo ou editar o `_journal.json` à mão pode deixar a migration com um `when` mais antigo que o da última aplicada, e o Drizzle a pularia sem avisar.
- O deploy continua sem esperar o CI: uma migration que quebra o e2e ainda chega em produção. Exigir CI verde (branch protection na `main`) ficou fora desta decisão.
- Entrada em produção, com passos humanos antes do merge da implementação: criar a `MIGRATION_DATABASE_URL` no ambiente Production da Vercel; conferir para que banco aponta a `DATABASE_URL` de Preview; rodar `pnpm db:check` contra produção e confirmar que não há drift, para que o primeiro deploy não carregue surpresa.

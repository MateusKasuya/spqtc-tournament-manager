# Coding Standards

Convenções deste repositório que o tooling não enforça — ESLint e `tsc` cuidam do resto e não repetimos aqui o que eles pegam. O eixo Standards do `/code-review` lê este arquivo.

## Arquitetura em camadas

- Fluxo: páginas RSC (`src/app`) buscam dados via `src/db/queries/*` e renderizam; toda mutação passa por server action (`src/actions/*`); componentes client chamam as actions diretamente.
- Lógica de domínio pura (Ledger de Knockout, tabela de pontos, defaults) vive em `src/lib/` como função pura e testável. Actions orquestram (auth → validação → transação → revalidate); cálculo não trivial não fica inline na action.
- Persistência de eventos vive em `src/db/ledger/*` (adapter de ledger, ver abaixo): a action descreve o evento e delega; o adapter carrega o snapshot, chama o núcleo puro e aplica o plano dentro da transação do chamador.
- Um arquivo por entidade em `src/actions/` e `src/db/queries/` (`seasons.ts`, `participants.ts`, …).

## Server actions (`src/actions`)

Toda action segue o mesmo esqueleto, nesta ordem:

1. `const auth = await requireAdmin(); if ("error" in auth) return auth;`
2. Validação com zod via `safeParse`; em falha, `return { error: parsed.error.issues[0].message }`.
3. Mutação — passos múltiplos sempre dentro de `db.transaction`.
4. `revalidatePath(...)` para **todas** as rotas afetadas.
5. Retorno `{ success: "..." }`.

- Erro esperado (validação, regra de negócio, estado inválido) retorna `{ error: string }` — nunca `throw`. Exceção é só para bug/infra.
- Mensagens de `error`/`success` em pt-BR, voltadas ao usuário final.

## Adapter de ledger (`src/db/ledger`)

Persistência de eventos (hoje: o Ledger de Knockout, `knockout-ledger.ts`). Categoria distinta de query e de action:

- Recebe a transação do chamador (`LedgerExecutor`) e nunca abre a própria; sem auth, sem `revalidatePath`. A action continua dona de auth → precondição → `db.transaction` → revalidate.
- Toda regra fica no núcleo puro em `src/lib/` (snapshot → plano); o adapter só carrega o snapshot, carimba um único `createdAt` do app nas linhas do evento (ADR 0001), aplica o plano (insert em lote, delete por id, um update por patch) e devolve o resultado.
- Estado esperado nunca lança para fora da action: erros do ledger são classes próprias (`KnockoutLedgerError`) que a action converte para `{ error }`; um resultado negativo é erro de invariante e aborta a transação inteira.
- A precondição roda fora da transação (mensagem ao usuário) e de novo dentro dela, após o lock do torneio; se o estado mudou, o adapter aborta com "A mesa mudou, recarregue e tente de novo".
- Leituras derivadas do ledger (ex.: contagem de Knockouts por Eliminador) também moram aqui, não em `queries/`.
- **Adapter do Relógio** (`tournament-clock.ts`): exceção deliberada às regras acima — não há evento nem transação, então ele usa `db` direto e roda ele mesmo a precondição de status (só Rodando), porque a leitura do status e do Relógio é o snapshot que a guarda compara. As 7 ações do Relógio passam por `applyClockTransition`, que carrega o torneio (só Rodando), o Relógio e os Níveis, aplica a transição do núcleo (`src/lib/tournament-clock.ts`) e grava com update condicional ao Relógio inteiro lido; conflito vira "A mesa mudou" (ou sucesso silencioso no Fim do nível, ADR 0002). Ação nova do Relógio entra por ele, nunca com read/update próprio.

## Precondições comuns das actions

- Status do torneio: a regra do `CONTEXT.md` mora em `STATUS_RULES` (`src/lib/tournament-status.ts`), um grupo por linha da regra, com uma mensagem de recusa por grupo. A action carrega o torneio com `getTournamentRequiringStatus(id, STATUS_RULES.<grupo>)`; ação que parte de um participante carrega o participante e depois o torneio dele pela mesma função. Dentro da transação, a contraparte é `lockTournamentRequiringStatus(tx, id, STATUS_RULES.<grupo>)` (`src/db/ledger/knockout-ledger.ts`, ao lado de `lockAndReadTournament`): trava o torneio, relê a linha e confere o Status relido, com o mesmo `{ tournament } | { error }`. A action de torneio devolve a recusa; a de participante a lança como `ParticipantRefusal` (`lockTournamentOrRefuse`). `lockTournament` sem releitura só serve a quem não decide pelo torneio.
- Precondição de entrada de participante fora do Ledger de Knockout (buy-in, add-on, bônus e os Desfazer): função pura em `src/lib/participant-entries.ts` que devolve `{ error } | null`. A action roda a mesma função na leitura de fora (resposta rápida) e de novo em `lockAndReload`, depois de travar o torneio e reler torneio e participante; só a releitura decide e fornece os valores gravados, e a recusa dela repete a mensagem da checagem de fora.
- Prêmio pago e quem pode receber Prêmio: "tem Prêmio pago" depende das transações `prize` (nunca de `participants.prizeAmount`), então não é função pura; `removeParticipant` e `undoBuyIn` consultam `hasPaidPrize` só dentro do lock, depois de `lockAndReload`, e recusam também quem está no Acordo (`dealPosition` do participante relido), com ou sem Prêmio. `distributePayouts` relê `(playerId, buyInPaid)` dentro do lock e decide com `checkPayoutRecipients`, sem leitura de participantes fora dele.
- Campos de `participants` que copiam o resultado da distribuição (`prizeAmount` e `dealPosition`, a posição do Acordo) espelham a distribuição: quem reescreve as transações `prize` reescreve a cópia do torneio inteiro, inclusive de quem saiu da lista, na mesma transação. Ler "tem Prêmio" continua sendo pelas transações.
- A Posição final só é escrita pela regra única `finalPositions` (`src/lib/knockout-ledger.ts`, ADR 0005), que combina a ordem da mesa com o Acordo: Knockout, Desfazer, buy-in e distribuição a reaplicam ao torneio inteiro, em vez de mexer na posição de um participante à mão.
- Entrada que o torneio permite (Rebuy, add-on, bônus e o limite de Rebuys, com 0 = ilimitado), se o Participante ainda pode fazer N Rebuys (`canRebuy`), buy-in confirmado (`hasConfirmedBuyIn`) e total pago (`totalPaid`): funções puras em `src/lib/tournament-entries.ts`. Todo código que precise disso (servidor ou tela) lê dali, em vez de repetir a condição ou a conta.
- Toda action que muda um torneio atualiza as telas com `revalidateTournament(id)` (detalhe, edição e mesa ao vivo), além das listagens e do ranking que ela afetar.
- Toda action de admin entra na tabela de `src/actions/__tests__/authorization.test.ts`; o teste falha se uma action exportada ficar fora.

## Queries (`src/db/queries`)

- Só leitura: sem auth, sem `revalidatePath`, sem efeitos colaterais.
- Busca por id retorna o registro ou `null` (`const [x] = await …; return x ?? null;`) — não lança quando não encontra.
- Exceção: `getTournamentRequiringStatus` (e `lockTournamentRequiringStatus`, a versão dentro do lock) devolve `{ tournament } | { error }` com a recusa em pt-BR, porque é a precondição de Status do torneio compartilhada pelas actions (ver "Precondições comuns das actions").

## Schema e migrations

- Um arquivo por tabela em `src/db/schema/`, re-exportado em `index.ts`. Coluna snake_case no banco, propriedade camelCase no TS.
- Enums de domínio como `text("…", { enum: […] })` com `.notNull().default(…)`.
- Tabelas têm `createdAt`/`updatedAt` como `timestamp(…, { withTimezone: true })`.
- Nunca editar migration já aplicada; mudança de schema = novo `pnpm db:generate`. A história replica do zero a partir de `drizzle/migrations/0000_baseline.sql` (as antigas ficam em `drizzle/_legacy_migrations/`, só referência). Os testes usam o DDL gerado do schema TS, por velocidade e isolamento: rode `pnpm test:schema` sempre que o schema TS mudar.
- RLS: escrita é só pelo Drizzle, nenhuma policy de escrita; policy de SELECT só para o que o cliente do Supabase lê (Realtime, `supabase.from`). Que toda tabela de `public` tenha RLS ligado é garantido por `src/db/__tests__/rls-migration.test.ts` — se ficar vermelho, a tabela nova precisa de uma migration custom (`pnpm db:generate --custom`) que ligue o RLS.
- Toda migration funciona com o código que já está no ar (expand/contract), porque o schema muda antes do código novo e o Instant Rollback da Vercel volta o código sem voltar o schema. Remover ou renomear coluna ou tabela, mudar tipo e ligar `NOT NULL` sem default são dois PRs: primeiro o código para de depender do que vai mudar, depois a migration destrutiva. Cobrado no review (ADR 0004).
- Conflito de numeração de migration entre branches: quem mergeia por último apaga a sua migration e roda `pnpm db:generate` de novo em cima da `main`. Nunca renomear o arquivo nem editar `drizzle/migrations/meta/_journal.json` à mão: o Drizzle só aplica migration com `when` maior que o da última aplicada e pularia a renomeada sem avisar.
- Migrations de produção rodam no build de Production da `main` na Vercel (ADR 0004). O `vercel.json` define o build command `pnpm build && pnpm db:migrate:deploy`: depois do `next build`, o `db:migrate:deploy` (`scripts/db-migrate-deploy.ts`, regra em `src/db/deploy-migrations.ts`) pega um `pg_advisory_lock`, aplica as migrations pendentes pela `MIGRATION_DATABASE_URL` (pooler de sessão do Supabase, só no ambiente Production) e confere o banco no modo deploy. Se a migration ou a conferência falhar, o build falha e a versão anterior continua no ar. Em Preview e em dev ele só imprime que pulou; em Production fora da `main` ou sem `MIGRATION_DATABASE_URL`, falha, e também falha com a `MIGRATION_DATABASE_URL` definida e a `VERCEL_ENV` vazia (variáveis de sistema da Vercel desligadas). Produção não se migra à mão (nada de `pnpm db:migrate` contra produção nem SQL no painel): migration que falha no deploy se corrige por PR.
- Sempre que houver dúvida sobre o banco, rode `pnpm db:check` (contra produção também: é só leitura). Ele lê o banco de `DATABASE_URL` (`.env.local`) numa transação `read only` e lista migrations do journal × aplicadas, RLS e policies de `public`, a publicação `supabase_realtime` e os triggers de `auth.users`. Sai com 1 se houver drift: migration pendente ou contagem diferente, tabela sem RLS, tabela da Mesa ao vivo (`MESA_REALTIME_TABLES`, em `src/lib/mesa-realtime.ts`) fora da publicação, ou falta do `on_auth_user_created`. Sai com 2 se não conseguir checar. Fora do Supabase, a publicação e o schema `auth` são só reportados.
- A conferência do banco mora em `src/db/check-database.ts` (`checkDatabase`), sobre a conexão Drizzle de qualquer driver (postgres-js ou pglite), e tem dois modos. `manual` é o do `pnpm db:check`: banco à frente do journal é drift. `deploy` é o da migration no build de Production (#162): banco à frente do journal só aparece no relatório, porque é o Redeploy de um commit antigo. Nos dois, migration não aplicada é a entrada do journal cujo `when` não está entre os `created_at` de `drizzle.__drizzle_migrations`, o que inclui a com `when` anterior à última aplicada, que o Drizzle pula sem avisar.

## Dinheiro e inteiros

- Dinheiro é `integer` em **centavos** em todo o backend. Conversão só nas bordas: formulário converte R$ → centavos no submit; exibição usa `formatCurrency` e afins de `src/lib/format.ts`.
- Nunca float para dinheiro, fichas ou pontos persistidos. Divisão usa inteiro + distribuição determinística do resto (os primeiros `resto` índices recebem +1), preservando conservação: a soma das partes é exatamente o total.

## Componentes (`src/components`)

- Organização por domínio (`tournament/`, `player/`, `live-table/`, …); primitivos shadcn ficam em `ui/` e não carregam regra de negócio.
- Client component: `"use client"` no topo, `useTransition` para chamar a action, resultado discriminado com `"error" in result` → `toast.error` / `toast.success` (sonner).
- Confirmação destrutiva simples usa `confirm(…)` nativo antes do `startTransition`.

## Idioma

- UI, mensagens de erro/sucesso, nomes de teste e commits: **pt-BR**. Strings de mensagem no código evitam acentos (padrão existente: "Nao autenticado", "sera desativada").
- Identificadores de código (variáveis, funções, tabelas) em inglês; rotas de página em português (`/torneios`, `/temporadas`, `/jogadores`).
- Comentários: raros, em português, só para restrição não óbvia (ex.: por que o schema de teste é consolidado).

## Testes

- Vitest + pglite (`pnpm test`). Teste de action é de integração: banco real em memória, sem mock de drizzle — mocka-se só a borda (`@/db` → testDb, supabase auth, `next/cache`, `next/navigation`), já configurado em `src/test/setup.ts`.
- Use os seeds de `src/test/setup.ts` (`seedTournament`, `seedPlayer`, `seedParticipant`, …) em vez de insert manual.
- Contrato de action: `expect(res).toHaveProperty("error")` / `.not.toHaveProperty("error")`, seguido da verificação de estado no banco via queries.
- Nome de teste em português descrevendo o comportamento ("addParticipant em torneio finished retorna erro").

## Commits e PRs

- Conventional commits em português: `feat:`, `fix:`, `chore:` — a mensagem descreve o comportamento e referencia issue/PR quando houver.
- Trabalho entra por branch + PR para `main`.

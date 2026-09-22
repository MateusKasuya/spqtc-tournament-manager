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

## Queries (`src/db/queries`)

- Só leitura: sem auth, sem `revalidatePath`, sem efeitos colaterais.
- Busca por id retorna o registro ou `null` (`const [x] = await …; return x ?? null;`) — não lança quando não encontra.

## Schema e migrations

- Um arquivo por tabela em `src/db/schema/`, re-exportado em `index.ts`. Coluna snake_case no banco, propriedade camelCase no TS.
- Enums de domínio como `text("…", { enum: […] })` com `.notNull().default(…)`.
- Tabelas têm `createdAt`/`updatedAt` como `timestamp(…, { withTimezone: true })`.
- Nunca editar migration já aplicada; mudança de schema = novo `pnpm db:generate`. As migrations NÃO replicam do zero (a 0008 cria FK incompatível) — o schema de teste é o DDL consolidado: rode `pnpm test:schema` sempre que o schema TS mudar.

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

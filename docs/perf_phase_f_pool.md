# Fase F — Revisar pool de conexão

**Objetivo:** Decidir se `max: 1` em `src/db/index.ts:13` faz sentido pro ambiente atual de deploy.

**Pré-requisito:** Fase 0 (pra saber quanto `Promise.all` é realmente paralelo hoje) + saber em qual provider o app roda.

---

## Contexto

`src/db/index.ts:13`:

```ts
const client = globalForDb.client ?? postgres(connectionString, { prepare: false, max: 1 });
```

`max: 1` significa **uma** conexão por instância de runtime. Consequência: `Promise.all` de 9 queries na mesma invocação vira 9 queries **sequenciais** na mesma conexão.

Isso é **padrão e correto** pra serverless (Vercel Functions, Lambda), onde:
- Cada invocação é um runtime isolado.
- Você não controla quantas invocações simultâneas existem.
- Supabase pgBouncer (porta 6543 / connection string `pooler.supabase.com`) gerencia o pool real.

Isso é **ruim** pra Node persistente (VPS, Railway, Fly.io com instância longa), onde:
- O processo vive horas/dias.
- Um processo atende N requests simultâneos.
- `max: 1` serializa tudo.

---

## Passos

### 1. Identificar o ambiente de deploy

- Olhar `next.config.js`, `vercel.json`, `Dockerfile`, `fly.toml`, `railway.json` — quem existe?
- Olhar `package.json` → `scripts.start` — é `next start`? Se sim, ambiente é flexível.
- Conferir o `DATABASE_URL` em produção:
  - Usa `pooler.supabase.com:6543`? → pool transacional (pgBouncer), `max: 1` está certo.
  - Usa `db.supabase.co:5432`? → conexão direta, `max: 1` é limitante.

### 2. Casos

#### Caso A — Vercel serverless / Netlify / Cloudflare Workers

**Manter `max: 1`.** Documentar a razão no código:

```ts
// max: 1 porque rodamos em serverless (Vercel).
// Cada invocação tem seu próprio runtime; o pool real é o pgBouncer do Supabase.
const client = globalForDb.client ?? postgres(connectionString, { prepare: false, max: 1 });
```

Decisão: **nada a mudar**, só documentar.

#### Caso B — Node persistente (Railway, Fly, VPS, Docker com `next start`)

**Subir `max` gradualmente.**

Regra geral: `max × instâncias ≤ 60% do limite do Postgres`.

- Supabase free tier: 60 conexões diretas.
- Supabase pro: 200.
- Se rodando 1 instância em Railway: `max: 10` é seguro.
- Se rodando 3 instâncias: `max: 10` cada = 30 conexões; ainda dentro do free tier.

Ajustar `src/db/index.ts`:

```ts
const client = globalForDb.client ?? postgres(connectionString, {
  prepare: false,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idle_timeout: 20,        // segundos
  max_lifetime: 60 * 30,   // 30 min
});
```

Usar env var (`DB_POOL_MAX`) permite ajustar sem redeploy de código.

### 3. Validar em prod

Depois do deploy, no Supabase SQL editor:

```sql
SELECT application_name, state, count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY application_name, state
ORDER BY count DESC;
```

Conferir:
- Conexões ativas não ultrapassam o esperado.
- Sem `too many connections` em logs da aplicação.

---

## Verificação

- **Se serverless (Caso A):** `console.time` num `Promise.all` de 5 queries paralelas — tempo total ≈ query mais lenta. Se tempo total ≈ soma das queries, há serialização e algo está errado no pool.
- **Se persistente com `max` aumentado:** mesmo teste acima. Tempo total deve cair drasticamente.

---

## Riscos

- **Esgotar limite do Postgres:** `max` alto × muitas instâncias → connection pool exhaustion. Começar conservador (5–10) e subir.
- **Prepared statements + pgBouncer transaction mode:** se `DATABASE_URL` aponta pro pooler em modo transaction, `prepare: false` é obrigatório (já está). Não ativar prepared statements nessa config.
- **Long-running transactions:** cada transaction em uso segura uma conexão do pool. Se uma action demora muito (ex: loop em bounty que ainda não foi refatorado — Fase E), conexões ficam presas.

---

## Quando pular essa fase

- Se é Vercel/serverless puro e `console.time` da Fase 0 já mostra `Promise.all` paralelo (é, porque pgBouncer distribui).
- Se as Fases B/D já resolveram o sintoma de lentidão a ponto de não fazer mais diferença.

---

## Considerações finais

Essa fase é quase sempre **documentação + validação**, não código novo. O valor é saber com certeza que o pool está dimensionado certo pro ambiente atual, e ter um parâmetro (`DB_POOL_MAX`) fácil de ajustar se o app escalar.

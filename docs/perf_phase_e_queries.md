# Fase E — Colapsar queries sequenciais em actions

**Objetivo:** Reduzir round-trips ao banco dentro de uma mesma server action. Atacar especificamente os loops sequenciais introduzidos pelo modo bounty (migration 0012).

**Pré-requisito:** Fases anteriores + medição clara na Fase 0 de quais actions são lentas no servidor.

---

## Alvos

- `src/actions/participants.ts:144-232` (`addRebuy`) — 4 round-trips.
- `src/actions/participants.ts:606-627` (`eliminatePlayer`) — loop com N updates.
- `src/actions/participants.ts:380-460` (`undoRebuy`) — SELECT + DELETE + múltiplos UPDATEs sequenciais.
- Qualquer outra action que a Fase 0 tenha flagrado como lenta.

---

## Técnicas

### 1. `RETURNING` do Postgres

Evitar `SELECT` depois de `INSERT`/`UPDATE`:

```ts
// ANTES
const participant = await tx.select().from(participants).where(eq(participants.id, id));
await tx.insert(transactions).values({ ... });

// DEPOIS
const [inserted] = await tx
  .insert(transactions)
  .values({ ... })
  .returning({ id: transactions.id, amount: transactions.amount });
```

### 2. UPDATE em lote com `VALUES` inline

Substituir loop `for (const ep of eliminators) { await tx.update(...) }` por um único UPDATE:

```sql
UPDATE participants AS p
SET current_bounty = v.new_bounty,
    bounties_collected = v.new_collected
FROM (VALUES
  (1, 100, 2),
  (2, 150, 3),
  (3, 80, 1)
) AS v(id, new_bounty, new_collected)
WHERE p.id = v.id;
```

No Drizzle isso vai precisar de `sql` template raw:

```ts
import { sql } from "drizzle-orm";

const values = eliminators.map(e => sql`(${e.id}, ${e.newBounty}, ${e.newCollected})`);
await tx.execute(sql`
  UPDATE participants AS p
  SET current_bounty = v.new_bounty,
      bounties_collected = v.new_collected
  FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, new_bounty, new_collected)
  WHERE p.id = v.id
`);
```

### 3. Collapsar SELECTs com JOIN

Se a action faz `getParticipantById` seguido de `select tournamentType from tournaments`, buscar tudo de uma vez:

```ts
const [row] = await tx
  .select({
    participant: participants,
    tournamentType: tournaments.tournamentType,
    bountyPercentage: tournaments.bountyPercentage,
  })
  .from(participants)
  .innerJoin(tournaments, eq(tournaments.id, participants.tournamentId))
  .where(eq(participants.id, participantId));
```

### 4. CTE para operações compostas

Para `undoRebuy`, combinar DELETE + UPDATE em uma CTE:

```sql
WITH deleted_tx AS (
  DELETE FROM transactions
  WHERE id = (
    SELECT id FROM transactions
    WHERE participant_id = $1 AND type = 'rebuy'
    ORDER BY created_at DESC LIMIT 1
  )
  RETURNING related_participant_id, bounty_change
)
UPDATE participants
SET rebuy_count = rebuy_count - 1,
    current_bounty = current_bounty - (SELECT bounty_change FROM deleted_tx)
WHERE id = $1;
```

---

## Passos

1. **Refatorar `addRebuy`:**
   - Buscar `participant` + `tournamentType` num único SELECT com JOIN.
   - `INSERT transaction ... RETURNING id` — usar o id retornado direto.
   - Se há atualização de bounty em eliminators, fazer via UPDATE em lote.

2. **Refatorar `eliminatePlayer`:**
   - O loop `for (const ep of eliminatorParticipants) await tx.update(...)` vira um único UPDATE com `VALUES` inline.
   - Adicionar medição antes/depois (`console.time`) pra confirmar o ganho.

3. **Refatorar `undoRebuy`:**
   - Colapsar o SELECT + DELETE + UPDATE da transação em uma CTE.
   - Cuidado: essa action tem lógica de bounty reversa — testar cada caminho.

4. **Testes de regressão obrigatórios:**
   - Criar torneio bounty, adicionar 5 participantes, fazer 3 rebuys com eliminações cruzadas, fazer undo. Conferir que `current_bounty`, `bounties_collected` e `rebuy_count` batem com o estado esperado.
   - Documentar em `docs/perf_phase_e_test_plan.md` se não houver suite automatizada.

---

## Verificação

- `console.time` em cada action refatorada mostra queda mensurável vs baseline.
- Número de statements no log do Postgres cai (Supabase → Logs → Postgres Logs).
- Fluxo de stress da Fase 0 (10 rebuys + 5 eliminações) fica sensivelmente mais rápido.

---

## Armadilhas

- **Drizzle + CTEs:** API é limitada, quase sempre precisa `sql` raw. Validar que tipos continuam corretos.
- **Transaction isolation:** se a lógica depende de ler um estado **depois** de modificá-lo dentro da mesma transaction, CTEs podem ter semântica sutil (vê o estado antes dos updates). Consultar docs do Postgres sobre `WITH` modificável.
- **Portabilidade:** `VALUES` inline e CTEs modificáveis são específicos de Postgres. Se algum dia migrar, documentar.
- **Ordem de operações em bounty:** o código atual faz rollback manual de bounty em undo. Um CTE que faz tudo numa tacada pode reordenar — testar cuidadosamente.

---

## Quando pular essa fase

Se a Fase 0 mostrou que nenhuma action passa de ~100ms no servidor, o ganho aqui é marginal. As fases B/C/G já eliminaram a percepção de lentidão. Deixar essa como "dívida técnica visível, não urgente".

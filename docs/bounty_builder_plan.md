# Bounty Builder — Plano de Implementacao

## Visao Geral

Nova modalidade de torneio **Bounty Builder (PKO - Progressive Knockout)** onde parte do buy-in e destinada a bounties. Quando um jogador perde todas as fichas, quem o eliminou recebe metade do bounty e a outra metade e acrescida ao seu proprio bounty.

---

## Mecanica Financeira

### Buy-in (com ranking fee)

```
Buy-in = R$50,00
Ranking fee = R$20,00
Liquido = R$30,00
Bounty % = 50% (configuravel)

Prize pool += R$15,00 (50% do liquido)
Bounty inicial do jogador = R$15,00 (50% do liquido)
```

### Rebuy (sem ranking fee)

```
Rebuy = R$50,00
Bounty % = 50%

Prize pool += R$25,00
Novo bounty do jogador = R$25,00
```

### Rebuy Duplo (sem ranking fee, 2x)

```
Rebuy duplo = R$100,00
Bounty % = 50%

Prize pool += R$50,00
Novo bounty do jogador = R$50,00
```

### Addon (sem ranking fee)

```
Addon = R$30,00
Bounty % = 50%

Prize pool += R$15,00
Acrescimo ao bounty do jogador += R$15,00
```

### Eliminacao (distribuicao do bounty — 1 eliminador)

```
Jogador X (bounty R$15,00) perde fichas pro Jogador Y

Ganho imediato do Y = floor(R$15,00 / 2) = R$7,50
Acrescimo ao bounty do Y = R$15,00 - R$7,50 = R$7,50

Bounty do X = R$0,00 (zerado)
bountiesCollected do Y += R$7,50
currentBounty do Y += R$7,50
```

### Eliminacao com multiplos eliminadores (split bounty)

```
Jogador X (bounty R$22,50) perde fichas pro Jogador Y e Jogador Z

metadePagamento = floor(R$22,50 / 2) = R$11,25
metadeAcrescimo = R$22,50 - R$11,25 = R$11,25
numEliminadores = 2

Para cada eliminador, dividir igualmente:
  pagamentoPorEliminador = floor(metadePagamento / numEliminadores)
  acrescimoPorEliminador = floor(metadeAcrescimo / numEliminadores)

  Y: recebe R$5,63 + bounty += R$5,63 (primeiro leva centavo extra)
  Z: recebe R$5,62 + bounty += R$5,62

Bounty do X = R$0,00 (zerado)
Uma transacao bounty_earned por eliminador
```

### Campeao

```
Ultimo jogador restante recebe seu proprio bounty restante
como bounty_earned. Ex: se bounty final = R$40,00, ele
recebe R$40,00 adicional.
```

---

## Fluxo na Mesa ao Vivo

### Contexto importante

No poker do SPQC, rebuy so acontece quando o jogador **perde todas as fichas**. Nao existe rebuy com fichas restantes. Portanto:

- **Rebuy** = jogador perdeu fichas + tem direito a voltar → admin escolhe eliminador, bounty e processado, jogador volta
- **Eliminar** = jogador perdeu fichas + NAO tem mais direito a rebuy → admin escolhe eliminador, bounty e processado, jogador sai

### Fluxo do Rebuy (Bounty Builder)

1. Jogador X perde todas as fichas
2. Admin clica **Rebuy** no Jogador X
3. Dialog abre: "Quem eliminou?" → admin seleciona **um ou mais jogadores** (lista de jogadores "playing")
4. Sistema processa:
   - Bounty do X e distribuido entre os eliminadores (50% ganho, 50% acrescimo, dividido igualmente)
   - Uma transacao `bounty_earned` criada **por eliminador**
   - Bounty do X e zerado
   - Transacao `rebuy` criada pro X
   - Novo bounty calculado do rebuy e atribuido ao X
5. Jogador X continua com status `playing`

### Fluxo do Rebuy Duplo (Bounty Builder)

Identico ao rebuy simples, mas:
- Duas transacoes de rebuy
- rebuyCount += 2
- Bounty novo = 2x o bounty do rebuy simples

### Fluxo da Eliminacao Definitiva (Bounty Builder)

1. Jogador X perde fichas, sem rebuy disponivel
2. Admin clica **Eliminar** no Jogador X
3. Dialog abre: "Quem eliminou?" → admin seleciona **um ou mais jogadores**
4. Sistema processa:
   - Bounty distribuido entre eliminadores (50/50 split, dividido igualmente)
   - Uma transacao `bounty_earned` por eliminador
   - Jogador X marcado como `eliminated` com finishPosition
5. Se restar apenas 1 jogador → coroado campeao, recebe proprio bounty

### Undo Rebuy (Bounty Builder)

- Reverte rebuyCount
- Deleta transacao de rebuy
- Reverte bounty: devolve o ganho de **cada eliminador**, restaura bounty antigo do jogador
- Deleta **todas** as transacoes `bounty_earned` associadas

### Undo Eliminacao (Bounty Builder)

- Reverte status para `playing`
- Reverte bounty: devolve ganho de **cada eliminador**, restaura bounty da vitima
- Deleta **todas** as transacoes `bounty_earned` associadas

---

## Alteracoes no Schema (Banco de Dados)

### Tabela `tournaments` — novos campos

| Campo | Tipo | Default | Descricao |
|---|---|---|---|
| `tournament_type` | text enum (`normal`, `bounty_builder`) | `normal` | Tipo do torneio |
| `bounty_percentage` | integer | `50` | % do valor liquido destinado a bounty |

### Tabela `participants` — novos campos

| Campo | Tipo | Default | Descricao |
|---|---|---|---|
| `current_bounty` | integer | `0` | Bounty atual do jogador (centavos) |
| `eliminated_by_ids` | jsonb (array de player IDs) | `[]` | Player IDs de quem eliminou (suporta split bounty) |
| `bounties_collected` | integer | `0` | Total de bounties recebidos em centavos |

### Tabela `transactions` — novo tipo

| Tipo | Descricao |
|---|---|
| `bounty_earned` | Bounty recebido por eliminar outro jogador |

Nota: cada eliminador recebe sua propria transacao `bounty_earned` com o valor proporcional.

---

## Alteracoes por Arquivo

### Schema e Migracao

| Arquivo | Mudanca |
|---|---|
| `src/db/schema/tournaments.ts` | +`tournamentType`, +`bountyPercentage` |
| `src/db/schema/participants.ts` | +`currentBounty`, +`eliminatedByIds` (jsonb), +`bountiesCollected` |
| `src/db/schema/transactions.ts` | +`bounty_earned` no enum de type |
| `drizzle/` | Nova migracao com ALTER TABLE |

### Server Actions

| Arquivo | Mudanca |
|---|---|
| `src/actions/tournaments.ts` | Aceitar `tournamentType` e `bountyPercentage` na criacao/edicao |
| `src/actions/participants.ts` | Detalhado abaixo |

**`confirmBuyIn`** — se bounty_builder:
- Calcular bounty inicial: `(buyIn - rankingFee) * bountyPct / 100`
- Setar `currentBounty` no participant

**`addRebuy`** — se bounty_builder:
- Novo parametro: `eliminatedByPlayerIds: number[]` (array, suporta multiplos)
- Processar bounty da vitima (50/50 split, dividido igualmente entre eliminadores)
- Criar uma transacao `bounty_earned` **por eliminador** com valor proporcional
- Zerar bounty do jogador
- Calcular novo bounty do rebuy: `rebuyAmount * bountyPct / 100`
- Setar `currentBounty` com novo valor

**`addDoubleRebuy`** — se bounty_builder:
- Mesmo que addRebuy mas com 2x rebuy e 2x bounty novo

**`addDoubleRebuy`** — se bounty_builder:
- Mesmo que addRebuy mas com 2x rebuy e 2x bounty novo
- Mesmo parametro `eliminatedByPlayerIds: number[]`

**`eliminatePlayer`** — se bounty_builder:
- Novo parametro: `eliminatedByPlayerIds: number[]`
- Processar bounty (50/50 split, dividido entre eliminadores)
- Criar uma transacao `bounty_earned` por eliminador
- Setar `eliminatedByIds` (jsonb array)
- Se ultimo jogador → campeao recebe proprio bounty como `bounty_earned`

**`undoRebuy`** — se bounty_builder:
- Reverter bounty de **cada eliminador** (devolver ganho, remover acrescimo)
- Restaurar bounty antigo do jogador
- Deletar **todas** transacoes `bounty_earned` associadas
- Limpar `eliminatedByIds`

**`undoElimination`** — se bounty_builder:
- Reverter bounty de **cada eliminador**
- Restaurar bounty da vitima
- Deletar **todas** transacoes `bounty_earned` associadas

### Componentes UI

| Arquivo | Mudanca |
|---|---|
| `src/components/tournament/tournament-form.tsx` | Campo tipo torneio + % bounty + preview calculo |
| `src/components/live-table/quick-actions.tsx` | Coluna Bounty + coluna Faturado + dialog "Quem eliminou?" nos botoes Rebuy/Eliminar |
| `src/components/live-table/mesa-ao-vivo.tsx` | Passar `tournamentType`, `bountyPercentage` e novos campos dos participants |
| `src/components/live-table/tournament-stats.tsx` | Card "Bounty Pool" (soma bounties ativos) |
| `src/components/tournament/financial-summary.tsx` | Linha "Bounties Pagos" no resumo financeiro |
| `src/components/tournament/payout-dialog.tsx` | Separar prize pool vs bounties coletados |
| `src/components/tournament/participant-list.tsx` | Mostrar bounty info quando bounty_builder |

### Queries

| Arquivo | Mudanca |
|---|---|
| `src/db/queries/participants.ts` | Retornar novos campos (currentBounty, eliminatedByIds, bountiesCollected) |
| `src/db/queries/tournaments.ts` | Retornar tournamentType e bountyPercentage |

### Types

| Arquivo | Mudanca |
|---|---|
| `src/types/` | Atualizar interfaces Participant e Tournament se houver types centralizados |

---

## Exibicao na Mesa ao Vivo (Quick Actions)

Colunas da tabela quando `bounty_builder`:

```
Status | Jogador | Bounty   | Faturado | Rebuys | Add-on | Bonus | Total  | Acoes
Jogando  Joao      R$25,00   R$7,50     1        —        —      R$100    [Rebuy] [2x Rebuy] [Eliminar]
Jogando  Maria     R$22,50   R$15,00    0        —        —      R$50     [Rebuy] [2x Rebuy] [Eliminar]
Jogando  Pedro     R$15,00   R$0,00     0        —        —      R$50     [Rebuy] [2x Rebuy] [Eliminar]
4o       Ana       —         R$0,00     0        —        —      R$50     [Desfazer]
```

- **Bounty**: valor atual na cabeca do jogador (so para jogadores playing/registered)
- **Faturado**: total de bounties que ele ja ganhou eliminando outros

---

## Dialog "Quem eliminou?"

Componente reutilizado por Rebuy, 2x Rebuy e Eliminar quando `bounty_builder`:

1. Admin clica no botao (Rebuy, 2x Rebuy ou Eliminar)
2. Dialog abre com lista dos jogadores `playing` (exceto o proprio) com **selecao multipla (checkbox)**
3. Admin seleciona um ou mais eliminadores
4. Botao confirmar so habilita quando pelo menos 1 eliminador esta selecionado
5. Acao e executada com `eliminatedByPlayerIds: number[]`

---

## Ordem de Implementacao

1. **Schema + Migracao** — campos novos no banco
2. **Server Actions** — logica de bounty em todas as acoes
3. **Queries** — retornar novos campos
4. **Tournament Form** — tipo de torneio + % bounty
5. **Live Table UI** — colunas bounty/faturado + dialog eliminador
6. **Financial Summary** — bounties no resumo
7. **Payout Dialog** — separar prize vs bounty
8. **Testes manuais** — validar fluxo completo

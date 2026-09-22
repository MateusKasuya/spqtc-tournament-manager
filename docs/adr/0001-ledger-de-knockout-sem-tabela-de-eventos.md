---
status: accepted
date: 2026-09-22
---

# Ledger de Knockout sem tabela de eventos

O Ledger de Knockout agrupa as linhas de um mesmo Knockout por um único `created_at` carimbado pelo app dentro da transação, apaga por chave primária e reconstrói o Bounty da Vítima por delta a partir das linhas do evento e das linhas posteriores (id serial maior), em vez de criar uma tabela `bounty_events` com FK em `transactions`. Escolhemos assim porque a tabela exigiria migration com backfill à mão, mudaria três leitores (resumo financeiro, extrato, contagem de Knockouts) e não fecharia nenhum bug que o delta e a recusa de Desfazer com dependência posterior já não fechem; a identidade explícita fica como passo aditivo (coluna `event_id` nullable) se um dia for necessária.

## Considered Options

- **Tabela `bounty_events` + FK** (event-sourced): identidade explícita, `before`/`after` guardados, replay das projeções. Rejeitada pelo custo de migration e pela mudança de comportamento em leitores que hoje funcionam.
- **Inferência por `created_at` do Postgres escondida atrás do seam**: zero schema, mas mantém o acoplamento ao relógio do banco (a classe de bug pglite vs Postgres) e exige ordem de operações no caller do undo de rebuy.
- **Carimbo único do app + delete por id + delta derivado** (escolhida).

## Consequences

- O "depois" do Bounty da Vítima não pode vir da configuração do torneio, porque `rebuyAmount` e `bountyPercentage` podem ser editados com o torneio em andamento; ele é derivado das linhas posteriores do ledger.
- Desfazer é recusado quando um Eliminador do Knockout já foi Vítima depois; um resultado negativo passa a ser erro de invariante, não clamp.
- Linhas legadas (gravadas com `now()` do Postgres) continuam agrupando por igualdade de `created_at` em texto.

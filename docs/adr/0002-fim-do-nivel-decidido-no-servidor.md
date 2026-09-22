---
status: proposed
date: 2026-09-22
---

# Fim do nível decidido no servidor, com o Relógio como núcleo puro

O Relógio do torneio passa a ser um núcleo puro (estado do Relógio + estrutura de Níveis + instante injetado → próximo estado) que as actions e o cliente compartilham, e o Fim do nível passa a ser uma única action (`expireLevel`, com o instante de início observado como trava) em que o servidor decide entre avançar o Nível e encerrar o Intervalo avulso. As colunas atuais de `tournaments` continuam sendo a persistência; não há migration. Escolhemos assim porque hoje o cálculo de Tempo restante existe em quatro cópias (duas actions, a pausa automática da Coroação e o hook do cliente), o cliente decide o que fazer no zero e cada desfecho tem seu próprio mecanismo de idempotência, e nenhuma das seis actions do Relógio tem teste.

## Considered Options

- **Manter o cliente decidindo no zero** (hoje): duas actions (`advanceBlindLevel` com trava por `timerStartedAt`, `endBreak` idempotente por `breakActive`) e o desvio no componente da mesa. Rejeitada: a regra do Fim do nível fica na UI e a idempotência é dupla.
- **Fim do nível por agendamento no servidor** (cron/trigger): elimina a dependência do cliente, mas exige infraestrutura nova e ainda precisa do mesmo núcleo para calcular o próximo estado. Rejeitada por custo; o cliente admin continua disparando, mas só avisa "chegou a zero".
- **Uma action de Fim do nível com trava por instante de início, decisão no núcleo puro** (escolhida).

## Consequences

- `advanceBlindLevel` (clique manual) e `expireLevel` (zero) são transições distintas do mesmo núcleo; o clique manual continua incondicional.
- O hook do cliente usa a mesma função de Tempo restante do núcleo; qualquer diferença entre o número da tela e o do servidor passa a ser bug de uma função só.
- A Pausa automática da Coroação vira a transição `pause` do núcleo aplicada dentro da transação do Ledger de Knockout; some a cópia em `participants.ts`.
- Reancorar o Nível quando a estrutura de blinds é editada continua com a mesma regra, mas movida para o núcleo como transição própria.

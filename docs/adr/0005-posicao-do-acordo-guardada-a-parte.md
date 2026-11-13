---
status: accepted
date: 2026-11-13
---

# A posição do Acordo é guardada à parte da Posição final

Cada Participante passa a ter, além da Posição final, a posição que o Acordo em vigor lhe deu (nula para quem está fora do Acordo). A Posição final deixa de ser editada à mão por cada caminho: ela sai de uma única regra que combina a ordem da mesa (Coroação e ordem inversa das Eliminações) com o Acordo — quem está no Acordo fica com a posição dele; quem está fora é posicionado pela mesa, pulando as posições do Acordo. Knockout, Desfazer, Coroação, buy-in tardio e Distribuir prêmios aplicam essa mesma regra. Escolhemos assim porque o Acordo só existia misturado na Posição final, e toda renumeração da mesa o apagava (#168): um Acordo feito com o torneio Rodando perdia o 1º na Coroação, posições se repetiam entre Knockouts, e o Encerrar gravava pontos de Ranking pela ordem da mesa enquanto os Prêmios seguiam o Acordo.

## Considered Options

- **Reconstruir o Acordo a partir das transações `prize`**: uma posição do Acordo com Prêmio 0 não gera transação, e a transação não guarda a posição. Rejeitada.
- **Cada caminho de renumeração "não toca" em quem tem Prêmio**: mesma falha com Prêmio 0, e espalha a regra por quatro caminhos. Rejeitada.
- **Recusar Knockouts depois de um Acordo, ou recusar Distribuir prêmios com o torneio Rodando**: o jogo continua depois do Acordo (título, Bounties, Acordo parcial), e o Acordo na mesa final é um fluxo do domínio. Rejeitada.
- **Tabela própria de distribuições**: mais pesada, sem ganho visível hoje. Rejeitada.
- **Coluna nula em `participants` com a posição do Acordo** (escolhida).

## Consequences

- Migration aditiva (coluna nula), compatível com o código no ar (ADR 0004). Sem backfill: torneios já afetados são achados por consulta e corrigidos refazendo a distribuição.
- A Posição final continua gravada (Ranking, Mesa e telas a leem como hoje), mas só a regra única a escreve.
- Quem está no Acordo, com ou sem Prêmio, não pode ser removido nem ter o buy-in desfeito: refazer a distribuição sem ele vem antes.

# Tournament Manager

Gestão dos torneios de poker do grupo SPQC: cadastro, mesa ao vivo (timer, blinds, eliminações, rebuys), premiação e ranking por temporada.

## Language

### Torneio

**Bounty Builder**:
Modalidade de torneio em que cada participante carrega um Bounty que é redistribuído a cada Knockout.
_Avoid_: torneio bounty, modo bounty

**Rebuy**:
Recompra de fichas por um participante que caiu; em Bounty Builder o participante volta com um Bounty novo.
_Avoid_: recompra

### Knockout

**Knockout**:
Evento em que um participante cai para um ou mais Eliminadores. Termina em Eliminação ou em Rebuy. É o mesmo evento em torneio normal e em Bounty Builder; só a redistribuição de Bounty muda.
_Avoid_: KO, eliminação (quando se refere ao evento e não ao desfecho)

**Eliminação**:
Desfecho de um Knockout em que a Vítima sai do torneio e recebe sua posição final.

**Vítima**:
O participante que caiu em um Knockout.
_Avoid_: eliminado

**Eliminador**:
Participante que derrubou a Vítima em um Knockout e recebe parte do Bounty dela.
_Avoid_: killer

**Bounty**:
Valor sobre a cabeça de um participante em Bounty Builder. Em um Knockout, metade vai em dinheiro para os Eliminadores e metade se soma ao Bounty deles.
_Avoid_: prêmio, recompensa

**Bounty coletado**:
Dinheiro que um participante já ganhou como Eliminador ao longo do torneio.

**Coroação**:
Knockout final que deixa um único participante em jogo; ele se torna campeão e coleta o próprio Bounty.

**Ledger de Knockout**:
Registro de todos os Knockouts de um torneio e de seus efeitos sobre Bounty e Bounty coletado. É a fonte da contagem de Knockouts por Eliminador e do Desfazer.
_Avoid_: ledger de bounty, histórico de transações

**Desfazer**:
Reversão do Knockout mais recente de uma Vítima, devolvendo a ela o Bounty e retirando dos Eliminadores exatamente o que receberam. Recusado quando um Eliminador daquele Knockout já foi Vítima depois.
_Avoid_: undo, estorno

**Conservação**:
Propriedade de que a soma dos Bounties em jogo mais os Bounties coletados é sempre igual ao total de Bounty armado por buy-ins e rebuys. Todo Knockout e todo Desfazer a preservam.

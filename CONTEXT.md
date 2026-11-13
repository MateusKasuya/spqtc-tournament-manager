# Tournament Manager

Gestão dos torneios de poker do grupo SPQC: cadastro, mesa ao vivo (timer, blinds, eliminações, rebuys), premiação e ranking por temporada.

## Language

### Participantes

**Jogador**:
Pessoa do cadastro do grupo SPQC; é quem pontua no ranking da temporada.
_Avoid_: player, membro

**Participante**:
Jogador inscrito em um torneio.
_Avoid_: inscrito, jogador (quando se refere à inscrição)

**Aguardando buy-in**:
Participante inscrito cujo buy-in ainda não foi confirmado.
_Avoid_: pendente, registrado

**Em jogo**:
Participante com buy-in confirmado que ainda disputa o torneio: nem teve Eliminação, nem é o Coroado.
_Avoid_: ativo, vivo, jogando

**Posição final**:
Colocação do Participante no torneio: 1 para o Campeão, que é o Coroado a não ser que um acordo dê o 1º a outro; para quem caiu, a ordem inversa das Eliminações, sem repetir e sem buracos (o último a cair fica logo abaixo de quem ainda está em jogo). É renumerada quando um Desfazer ou um buy-in tardio muda o número de Participantes. Um acordo fixa a Posição final de quem está nele, mesmo de quem ainda está em jogo, e só refazer a distribuição a muda: o jogo pode continuar depois do acordo, mas Knockout, Desfazer, Coroação e buy-in tardio só posicionam quem está fora do acordo, pulando as posições do acordo. Quem sai do acordo ao refazer a distribuição volta à posição que a mesa dá (sem posição se ainda está em jogo, a da Eliminação se caiu), pulando as posições do acordo. O Coroado fora do acordo mantém o 1º, a não ser que o acordo dê o 1º a outro: aí ele também pula as posições do acordo e fica com a primeira livre.
_Avoid_: colocação, finish position

### Torneio

**Bounty Builder**:
Modalidade de torneio em que cada participante carrega um Bounty que é redistribuído a cada Knockout.
_Avoid_: torneio bounty, modo bounty

**Rebuy**:
Recompra de fichas por um participante que caiu; em Bounty Builder o participante volta com um Bounty novo.
_Avoid_: recompra

**Status do torneio**:
Pendente (inscrições, antes de começar), Rodando, Encerrado ou Cancelado. Encerrado e Cancelado são finais; Rodando não volta a Pendente. O status decide o que pode ser feito:
- inscrever/remover participante e confirmar/desfazer buy-in: Pendente ou Rodando;
- Relógio, Knockout, Rebuy, add-on, bônus e Desfazer: só Rodando;
- Distribuir prêmios: Rodando ou Encerrado;
- editar estruturas de blinds e de prêmios: Pendente ou Rodando;
- editar os dados do torneio (nome, data, temporada, limite de Rebuys, permissão de add-on): Pendente ou Rodando;
- editar as fichas (iniciais, de Rebuy, de add-on, de bônus): só Pendente. As fichas de cada entrada não são guardadas, então mudá-las depois de começar recalcularia o passado. Exceção: as fichas de add-on continuam livres enquanto o add-on não é permitido e ninguém fez add-on, porque não há add-on a recalcular; assim dá para ligar o add-on, com valor e fichas, depois de começar;
- editar os valores de buy-in, Rebuy e add-on, a taxa de ranking, o tipo do torneio e o percentual de Bounty: só Pendente e só enquanto nenhum buy-in foi confirmado. O Bounty inicial é fixado no buy-in, e as telas de total pago multiplicam os valores do torneio pelas contagens de buy-in, Rebuy e add-on de cada participante, então mudá-los depois do primeiro buy-in reescreveria o passado. Desfazer o buy-in exige desfazer antes os Rebuys e add-ons, então sem buy-in confirmado também não há Rebuy nem add-on registrado. Exceção: o valor do add-on continua livre enquanto o add-on não é permitido e ninguém fez add-on, porque não há total pago a reescrever; assim dá para ligar o add-on, com valor, depois de começar;
- cancelar o torneio: de Pendente ou Rodando;
- excluir o torneio: só Pendente ou Cancelado. Um torneio Rodando é cancelado antes; um Encerrado não é excluído porque carrega o histórico e os pontos do ranking da temporada.

Independente do Status, o buy-in não pode ser menor que a taxa de ranking (igual pode, e o Bounty inicial de um Bounty Builder fica zero). A regra vale sempre ao criar o torneio. Ao editar, vale quando muda algo que entra no Bounty inicial (buy-in, taxa, tipo do torneio ou percentual de Bounty), para que um torneio antigo gravado com buy-in abaixo da taxa continue editável nos outros campos sem virar Bounty Builder com Bounty negativo.
_Avoid_: finalizado, ativo

### Fichas

**Fichas em jogo**:
Todas as fichas que entraram no torneio por buy-ins, Rebuys, add-ons e bônus. Nenhuma ficha sai do jogo, então é o total que está na mesa.
_Avoid_: total de fichas, chips

**Stack médio**:
Fichas em jogo divididas pelos Participantes em jogo.
_Avoid_: média de fichas

### Prêmios

**Arrecadado**:
Todo o dinheiro que entrou no torneio por buy-ins, Rebuys e add-ons.

**Fundo de ranking**:
Parte do Arrecadado reservada ao ranking da temporada: a taxa de ranking vezes o número de participantes com buy-in confirmado. Rebuys e add-ons não contribuem.
_Avoid_: taxa, rake

**Bounty armado**:
Total de Bounty criado por buy-ins e Rebuys em Bounty Builder. Pela Conservação, é igual ao Bounty em jogo mais os Bounties coletados.
_Avoid_: bounty pool

**Prize pool**:
O que sobra para os Prêmios: Arrecadado menos Fundo de ranking menos Bounty armado. É sempre derivado, nunca digitado.
_Avoid_: pote, premiação

**Estrutura de prêmios**:
Percentual do Prize pool que cabe a cada posição (padrão 45/25/15/10/5), ajustável por torneio.
_Avoid_: distribuição de prêmios (quando se refere aos percentuais)

**Prêmio**:
Valor pago a um participante por sua posição final. Só recebe Prêmio quem tem buy-in confirmado (Em jogo ou eliminado). A soma dos Prêmios nunca passa do Prize pool. Quem tem Prêmio pago não pode ser removido nem ter o buy-in desfeito: antes, refaz-se a distribuição sem ele.

**Prêmio estimado**:
O que a Estrutura de prêmios daria a uma posição com o Prize pool atual. Muda a cada buy-in, Rebuy ou add-on e só vira Prêmio quando é distribuído.
_Avoid_: prêmio previsto, projeção

**Posições premiadas**:
Posições da Estrutura de prêmios com percentual maior que zero.
_Avoid_: posições pagas

**Fronteira do dinheiro**:
Última posição com Prêmio garantido: o fim da sequência contínua de Posições premiadas a partir do 1º, que para na primeira posição com 0%. Para no buraco porque quem cai numa posição de 0% não leva Prêmio, então nenhuma posição abaixo dele é garantida (com 70/30/0/10, a fronteira é o 2º, e o 4º fica fora dela). Sem posição de 0% no meio, é o número de Posições premiadas; com o 1º em 0%, não há fronteira.
_Avoid_: bolha (para a posição; Bolha é o momento)

**No dinheiro**:
Momento em que todos os Participantes em jogo já têm Prêmio garantido: Em jogo não passa da Fronteira do dinheiro.
_Avoid_: ITM, zona de prêmio

**Bolha**:
Momento em que falta uma Eliminação para o dinheiro (Em jogo é uma a mais que a Fronteira do dinheiro); quem cai ali não leva Prêmio.
_Avoid_: bubble

**Distribuir prêmios**:
Registrar os Prêmios pagos a cada posição. Pode ser feito com o torneio rodando (acordo na mesa final) ou encerrado, nunca em torneio cancelado; refazer substitui a distribuição anterior: quem fica fora da nova perde o Prêmio e a posição que o acordo lhe deu. Só entra quem tem buy-in confirmado: um Jogador não inscrito ou aguardando buy-in recusa a distribuição inteira. Refazer a distribuição sem um participante é o caminho para depois removê-lo ou desfazer o buy-in dele: quem está no Acordo, com ou sem Prêmio, não pode ser removido nem ter o buy-in desfeito.
_Avoid_: pagar payouts

**Acordo**:
O resultado em vigor de Distribuir prêmios: quem recebe e a Posição final que cada um recebe. Feito na mesa final (torneio rodando) ou no acerto depois de Encerrar; refazer a distribuição o substitui. Fixa a Posição final de quem está nele: o jogo pode continuar depois de um Acordo, mas nenhum Knockout, Desfazer, Coroação ou buy-in tardio muda essas posições.
_Avoid_: deal, chop

**Saldo**:
Prize pool menos os Prêmios já pagos. Pode sobrar, por acordo de mesa ou arredondamento; não pode ficar negativo. Distribuir prêmios acima do Prize pool, ou desfazer um buy-in, Rebuy ou add-on que o deixaria negativo, é recusado.

### Knockout

**Knockout**:
Evento em que um participante cai para um ou mais Eliminadores. Termina em Eliminação ou em Rebuy. É o mesmo evento em torneio normal e em Bounty Builder, mas só em Bounty Builder os Eliminadores são registrados e o Bounty é redistribuído.
_Avoid_: KO, eliminação (quando se refere ao evento e não ao desfecho)

**Eliminação**:
Desfecho de um Knockout em que a Vítima sai do torneio e recebe sua posição final.

**Vítima**:
O participante que caiu em um Knockout.
_Avoid_: eliminado

**Eliminador**:
Participante que derrubou a Vítima em um Knockout e recebe parte do Bounty dela. Só é registrado em Bounty Builder; é dele que sai o bônus de ranking por Knockout.
_Avoid_: killer

**Bounty**:
Valor sobre a cabeça de um participante em Bounty Builder. Em um Knockout, metade vai em dinheiro para os Eliminadores e metade se soma ao Bounty deles.
_Avoid_: prêmio, recompensa

**Bounty em jogo**:
Soma dos Bounties dos Participantes em jogo. Cai a cada Eliminação, pode subir num Rebuy (a Vítima volta com Bounty novo) e zera na Coroação; com os Bounties coletados, fecha o Bounty armado.
_Avoid_: bounty pool

**Bounty coletado**:
Dinheiro que um participante já ganhou como Eliminador ao longo do torneio.

**Coroação**:
Knockout final que deixa um único participante em jogo; ele é o Coroado e coleta o próprio Bounty.

**Coroado**:
Participante que a Coroação deixou como único em jogo. Fica com a Posição final 1, a não ser que um acordo dê o 1º a outro, e continua dono do próprio Bounty coletado na Coroação. O Desfazer o descoroa, e ele volta a ficar Em jogo.
_Avoid_: campeão (quando o acordo deu o 1º a outro)

**Campeão**:
Participante com a Posição final 1, e só depois da Coroação. Sem acordo, é o Coroado. Se um acordo dá o 1º a outro, o Campeão é quem recebeu o 1º, mesmo que já tenha caído; o Coroado continua dono do próprio Bounty coletado na Coroação.
_Avoid_: vencedor

**Ledger de Knockout**:
Registro de todos os Knockouts de um torneio e de seus efeitos sobre Bounty e Bounty coletado. É a fonte da contagem de Knockouts por Eliminador e do Desfazer.
_Avoid_: ledger de bounty, histórico de transações

**Desfazer**:
Reversão do Knockout mais recente de uma Vítima, devolvendo a ela o Bounty e retirando dos Eliminadores exatamente o que receberam. Recusado quando um Eliminador daquele Knockout já foi Vítima depois. Desfazer uma Eliminação renumera a Posição final de quem caiu depois da Vítima. Quem está no Acordo volta a ficar Em jogo com a posição do Acordo, inclusive o Coroado descoroado.
_Avoid_: undo, estorno

**Conservação**:
Propriedade de que a soma dos Bounties em jogo mais os Bounties coletados é sempre igual ao total de Bounty armado por buy-ins e rebuys. Todo Knockout e todo Desfazer a preservam.

### Relógio

**Relógio do torneio**:
Estado do tempo da mesa ao vivo: o Nível atual, o Tempo restante, se está correndo ou em Pausa, e se há um Intervalo avulso em andamento. Existe um por torneio e é o mesmo em todas as telas abertas.
_Avoid_: timer (em prosa), cronômetro

**Nível**:
Entrada da estrutura de blinds (small, big, ante, duração). O Relógio sempre aponta para um Nível.
_Avoid_: level, estágio, blind atual

**Intervalo da estrutura**:
Nível marcado como intervalo dentro da estrutura de blinds. Conta como um Nível: tem duração própria e o Relógio passa por ele na ordem.
_Avoid_: break estrutural, nível de break

**Intervalo avulso**:
Pausa cronometrada que o admin inicia fora da estrutura (por exemplo 5, 10 ou 15 minutos). Ao terminar, o Nível volta com o Tempo restante que tinha quando o Intervalo avulso começou.
_Avoid_: break, intervalo dinâmico

**Nível de retorno**:
Nível cujos blinds valem quando um Intervalo termina: no Intervalo da estrutura, o próximo Nível; no Intervalo avulso, o Nível que foi interrompido.
_Avoid_: nível seguinte

**Pausa**:
Relógio parado com o Tempo restante congelado. Não é um Intervalo: nada conta enquanto dura.
_Avoid_: stop, parada

**Tempo restante**:
Segundos que faltam no Nível ou no Intervalo avulso. É derivado do instante em que o Relógio começou a correr e do tempo que tinha ao começar; nenhuma tela conta o tempo por conta própria.
_Avoid_: countdown, remaining

**Fim do nível**:
Momento em que o Tempo restante chega a zero com o Relógio correndo. O Relógio passa ao próximo Nível (ou encerra o Intervalo avulso) exatamente uma vez, mesmo com várias telas de admin abertas.
_Avoid_: auto-advance, estourar o timer

**Pausa automática**:
Pausa aplicada pelo próprio sistema quando a Coroação encerra o torneio.


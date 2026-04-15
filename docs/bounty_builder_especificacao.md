# Bounty Builder — Especificacao para Validacao

## O que e o Bounty Builder?

E uma modalidade de torneio onde cada jogador tem um **bounty (recompensa)** na cabeca. Quando voce elimina alguem, recebe parte do bounty dele em dinheiro e a outra parte e acrescida ao seu proprio bounty, tornando sua cabeca mais valiosa. Quanto mais jogadores voce elimina, maior o premio de quem te eliminar.

---

## Como funciona o dinheiro

### Entrada no torneio (Buy-in)

O buy-in e dividido em tres partes:

| Destino | Exemplo (buy-in R$50) |
|---|---|
| Fundo de ranking | R$20,00 |
| Prize pool (premiacao final) | R$15,00 |
| Bounty inicial do jogador | R$15,00 |

A divisao entre prize pool e bounty e configuravel (padrao 50/50 do valor liquido apos ranking fee).

### Rebuy

Quando o jogador faz rebuy, **nao ha desconto de ranking fee**. O valor e dividido entre prize pool e bounty:

| Destino | Exemplo (rebuy R$50) |
|---|---|
| Prize pool | R$25,00 |
| Novo bounty do jogador | R$25,00 |

### Rebuy Duplo

Mesma logica do rebuy simples, porem com o dobro do valor:

| Destino | Exemplo (rebuy duplo R$100) |
|---|---|
| Prize pool | R$50,00 |
| Novo bounty do jogador | R$50,00 |

### Add-on

Mesma logica do rebuy (sem ranking fee):

| Destino | Exemplo (addon R$30) |
|---|---|
| Prize pool | R$15,00 |
| Acrescimo ao bounty do jogador | R$15,00 |

---

## Como funciona a eliminacao

Quando um jogador perde todas as fichas, o bounty dele e dividido ao meio:

- **Metade** → pagamento imediato para quem eliminou (dinheiro no bolso)
- **Outra metade** → acrescida ao bounty de quem eliminou (cabeca fica mais valiosa)

### Exemplo passo a passo

```
Inicio do torneio (buy-in R$50, ranking R$20):
  Joao:  bounty R$15,00
  Maria: bounty R$15,00
  Pedro: bounty R$15,00
  Ana:   bounty R$15,00

Rodada 1 — Maria elimina Ana:
  Maria recebe R$7,50 (metade do bounty da Ana)
  Bounty da Maria: R$15 + R$7,50 = R$22,50
  Ana faz rebuy (R$50):
    Ana volta com bounty R$25,00 (50% do rebuy)

Rodada 2 — Joao elimina Maria:
  Joao recebe R$11,25 (metade de R$22,50)
  Bounty do Joao: R$15 + R$11,25 = R$26,25
  Maria faz rebuy duplo (R$100):
    Maria volta com bounty R$50,00

Rodada 3 — Pedro elimina Ana (definitivo, sem mais rebuys):
  Pedro recebe R$12,50 (metade de R$25)
  Bounty do Pedro: R$15 + R$12,50 = R$27,50
  Ana esta eliminada definitivamente (4o lugar)

Rodada 4 — Joao elimina Pedro:
  Joao recebe R$13,75 (metade de R$27,50)
  Bounty do Joao: R$26,25 + R$13,75 = R$40,00
  Pedro esta eliminado (3o lugar)

Final — Joao elimina Maria:
  Joao recebe R$25,00 (metade de R$50)
  Joao e campeao, recebe seu proprio bounty restante: R$40 + R$25 = R$65,00
```

### Resumo do exemplo — O que cada jogador levou de bounty

| Jogador | Bounties recebidos | Proprio bounty (campeao) | Total bounty |
|---|---|---|---|
| Joao (1o) | R$11,25 + R$13,75 + R$25,00 | R$65,00 | R$115,00 |
| Maria (2o) | R$7,50 | — | R$7,50 |
| Pedro (3o) | R$12,50 | — | R$12,50 |
| Ana (4o) | R$0,00 | — | R$0,00 |

Alem dos bounties, os jogadores que ficaram nas primeiras posicoes recebem a premiacao do **prize pool** conforme a estrutura de premiacao definida.

---

## Eliminacao com mais de um eliminador (Split Bounty)

Quando dois ou mais jogadores participam da eliminacao de um jogador (ex: split pot, all-in multiway), o bounty e dividido igualmente entre todos os eliminadores.

### Regra

```
Bounty da vitima = R$30,00
Numero de eliminadores = 2

Metade para pagamento = R$15,00 → R$7,50 para cada eliminador
Metade para acrescimo = R$15,00 → R$7,50 acrescido ao bounty de cada eliminador
```

Se a divisao nao for exata (centavos), o primeiro eliminador selecionado recebe o centavo extra.

### Exemplo

```
Ana (bounty R$22,50) perde all-in contra Joao e Maria ao mesmo tempo

Metade pagamento = R$11,25
  Joao recebe R$5,63 (arredondado pra cima)
  Maria recebe R$5,62

Metade acrescimo = R$11,25
  Bounty do Joao += R$5,63
  Bounty da Maria += R$5,62

Ana: bounty zerado
```

### Fluxo do admin

1. Admin clica em **Rebuy** ou **Eliminar** no jogador
2. Dialog pergunta: **"Quem eliminou?"**
3. Admin seleciona **um ou mais jogadores** da lista
4. Sistema divide o bounty igualmente entre os selecionados

---

## Fluxo do administrador na mesa ao vivo

### Quando um jogador perde todas as fichas e tem rebuy disponivel

1. Admin clica em **Rebuy** (ou **2x Rebuy**) no jogador
2. Sistema pergunta: **"Quem eliminou?"**
3. Admin seleciona **um ou mais eliminadores** na lista de jogadores ativos
4. O bounty e processado automaticamente (dividido se mais de um eliminador) e o jogador volta ao jogo

### Quando um jogador perde todas as fichas e NAO tem mais rebuy

1. Admin clica em **Eliminar** no jogador
2. Sistema pergunta: **"Quem eliminou?"**
3. Admin seleciona **um ou mais eliminadores**
4. O bounty e processado (dividido se mais de um) e o jogador e eliminado definitivamente

### Ultimo jogador — Campeao

Quando restar apenas um jogador, ele e automaticamente coroado campeao e recebe o bounty que estava na propria cabeca.

---

## O que aparece na tela durante o torneio

A tabela de jogadores na mesa ao vivo mostra duas informacoes extras:

| Coluna | O que mostra |
|---|---|
| **Bounty** | Quanto vale a cabeca do jogador naquele momento |
| **Faturado** | Quanto ele ja ganhou eliminando outros jogadores |

Exemplo visual:

```
Status    Jogador    Bounty      Faturado     Acoes
Jogando   Joao       R$26,25     R$11,25      [Rebuy] [2x Rebuy] [Eliminar]
Jogando   Maria      R$50,00     R$7,50       [Rebuy] [2x Rebuy] [Eliminar]
Jogando   Pedro      R$27,50     R$12,50      [Rebuy] [2x Rebuy] [Eliminar]
4o        Ana        —           R$0,00       [Desfazer]
```

---

## Configuracao ao criar o torneio

Ao criar um torneio, o administrador define:

| Campo | Descricao | Padrao |
|---|---|---|
| Tipo de torneio | Normal ou Bounty Builder | Normal |
| % Bounty | Percentual do valor liquido destinado a bounty | 50% |

Os demais campos (buy-in, rebuy, addon, ranking fee, fichas, blinds) permanecem iguais.

O sistema mostra um **preview** do calculo ao configurar:

```
Buy-in R$50,00 - Ranking R$20,00 = R$30,00 liquido
→ R$15,00 para premiacao (50%)
→ R$15,00 para bounty inicial (50%)
```

---

## Resumo financeiro do torneio

O resumo financeiro exibe a separacao clara dos valores:

```
Total arrecadado:        R$500,00
  Buy-ins (10x):         R$500,00
  Rebuys (4x):           R$200,00
  Add-ons (2x):          R$60,00

Destino:
  Fundo de ranking:      R$200,00
  Prize pool:            R$280,00
  Bounty pool:           R$280,00

Bounties ja pagos:       R$135,00
Bounties em jogo:        R$145,00
```

---

## Distribuicao de premios ao final

A premiacao final e dividida em duas partes:

1. **Prize pool** — distribuido conforme estrutura de premiacao (ex: 1o 45%, 2o 25%, 3o 15%, etc.)
2. **Bounties** — ja foram pagos durante o torneio (nao ha nada a distribuir, cada jogador ja recebeu)

O payout final mostra o total de cada jogador:

```
Posicao   Jogador   Premio      Bounties    Total
1o        Joao      R$126,00    R$115,00    R$241,00
2o        Maria     R$70,00     R$7,50      R$77,50
3o        Pedro     R$42,00     R$12,50     R$54,50
4o        Ana       R$28,00     R$0,00      R$28,00
5o        Lucas     R$14,00     R$0,00      R$14,00
```

---

## Perguntas para validacao

1. A divisao padrao 50/50 entre prize pool e bounty esta adequada? Devemos ter outro padrao?
2. O percentual deve ser configuravel por torneio ou fixo para todos?
3. O addon tambem deve gerar acrescimo de bounty ou ir 100% pro prize pool?
4. Quando o campeao recebe o proprio bounty, esse valor entra como "bounty faturado" ou como parte da premiacao?
5. Na eliminacao com multiplos eliminadores, a divisao igualitaria esta correta? Ou deveria ter alguma outra regra?
6. Algum outro cenario de jogo que nao foi coberto aqui?

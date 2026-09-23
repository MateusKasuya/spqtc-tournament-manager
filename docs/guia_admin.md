# Guia de Utilização — Admin SPQC

## Acesso

Acesse em [sopuxaquemtemcoragem.com.br](https://sopuxaquemtemcoragem.com.br). Faça login com seu email e senha. Caso não tenha conta, clique em **Cadastrar** na tela de login.

Somente usuários com papel **Admin** têm acesso às funcionalidades de gerenciamento.

---

## Temporadas

Antes de criar torneios, é necessário ter uma temporada ativa.

**Criar temporada:**
1. Menu → **Temporadas** → **Nova Temporada**
2. Preencha nome e data de início
3. Salve — ela já fica ativa automaticamente

Só pode haver uma temporada ativa por vez. Para encerrar uma temporada, clique no botão de toggle na lista de temporadas.

---

## Jogadores

**Cadastrar jogador:**
1. Menu → **Jogadores** → **Novo Jogador**
2. Preencha nome e apelido (opcional)
3. Salve

**Editar / Excluir:** use os ícones ao lado de cada jogador na lista.

> Jogadores são independentes de contas de usuário. Qualquer um pode ser cadastrado manualmente.

---

## Torneios

### Criar torneio

1. Menu → **Torneios** → **Novo Torneio**
2. Preencha:
   - **Nome** e **data/hora**
   - **Temporada** (associa ao ranking)
   - **Buy-in**, **Rebuy**, **Add-on** (valores em reais)
   - **Taxa de ranking** (descontada do pote, vai para o fundo de ranking)
   - **Fichas iniciais**, fichas de rebuy e add-on
   - **Max rebuys** (0 = ilimitado)
   - **Permitir add-on** (sim/não)
3. Salve

### Configurar estrutura de blinds

Na página do torneio → aba **Blinds** → **Editar Blinds**:
- Adicione níveis manualmente ou carregue um **template salvo**
- Cada nível tem: small blind, big blind, ante, duração (minutos)
- Marque níveis especiais: **Break** (Intervalo da estrutura — o Relógio trata como um Nível comum, com a duração que você definir), **Nível de Add-on**, **Big Ante**
- Dá para editar com o torneio em andamento: o Relógio continua no mesmo Nível. Se você editar ou remover o próprio Nível atual, o Relógio pausa no Nível que ficou com aquele número (ou no último, se ele sumiu) com a duração cheia
- Salve — você pode salvar como template para reutilizar

### Configurar premiação

Na página do torneio → aba **Prêmios** → **Editar Prêmios**:
- Defina quantas posições pagam e o percentual de cada uma
- O sistema calcula o valor automaticamente com base no pote
- Carregue um **template salvo** ou crie do zero
- A distribuição padrão é: 1° 45% / 2° 25% / 3° 15% / 4° 10% / 5° 5%

---

## Rodando um torneio

### 1. Inscrever jogadores

Na página do torneio → aba **Jogadores** → **Adicionar Jogador**:
- Selecione os jogadores que vão participar
- Marque **Buy-in pago** para cada um
- Rebuys e add-ons são registrados durante o torneio

### 2. Iniciar o torneio

Na página do torneio → botão **Iniciar Torneio**.

O status muda para **Em andamento** e o botão **Mesa ao Vivo** aparece.

### 3. Mesa ao Vivo

Clique em **Mesa ao Vivo** para abrir o painel de gerenciamento em tempo real.

**Relógio:**
- **Play/Pause** — inicia o Relógio ou faz a Pausa. O Tempo restante congela no segundo em que você pausa e continua dali ao retomar
- Sem estrutura de blinds o Relógio não inicia: aparece **"Sem estrutura de blinds"**. Configure os blinds antes
- **Próximo nível** — vai para o próximo Nível com a duração cheia. Se o Relógio estava correndo, continua correndo
- **Nível anterior** — volta para o Nível anterior com a duração cheia e **pausado** (voltar é correção de um avanço errado; aperte play para continuar)
- **Fim do nível** — quando o Tempo restante chega a zero, o Relógio passa sozinho ao próximo Nível e toca um som. Acontece uma vez só, mesmo com a mesa aberta em várias telas de admin (celular e TV). No último Nível, o Relógio fica em zero
- **Intervalo** (Intervalo avulso) — pausa cronometrada de 5, 10 ou 15 minutos fora da estrutura. O Relógio conta o intervalo em todas as telas e guarda o Tempo restante do Nível. Ao terminar (ou ao clicar **Encerrar intervalo**), o Nível volta **pausado** com o tempo que tinha; aperte play para retomar
- Ao eliminar o último jogador (Coroação), o Relógio pausa automaticamente
- Se dois admins apertarem o mesmo botão ao mesmo tempo, o segundo vê **"A mesa mudou, recarregue e tente de novo"** e o clique não é aplicado. Um clique feito depois que a outra tela já atualizou conta como um novo clique (por exemplo, apertar **Próximo nível** de novo avança mais um Nível)

**Blinds:**
- Exibe o nível atual, small blind, big blind e ante
- Mostra o próximo nível

**Ações rápidas (por jogador):**
- Registrar **rebuy**
- Registrar **add-on**
- Marcar jogador como **eliminado** (define posição de saída)

**Estatísticas:**
- Jogadores ativos / eliminados
- Pote total, fundo de ranking, prize pool

> A mesa ao vivo atualiza em tempo real — vários dispositivos podem acompanhar simultaneamente.

### 4. Distribuir prêmios

Na página do torneio → aba **Prêmios** → **Distribuir Prêmios**:
- Atribua a posição final de cada jogador
- O sistema calcula o valor de cada prêmio
- Confirme — os valores ficam registrados

### 5. Encerrar o torneio

Na página do torneio → botão **Encerrar Torneio**:
- Confirme na caixa de diálogo
- O status muda para **Finalizado**
- Os pontos de ranking são calculados automaticamente
- O torneio não pode mais ser editado

---

## Ranking

Menu → **Ranking**:
- Exibe a classificação da temporada ativa
- Mostra pontos por torneio, total de pontos, vitórias
- Clique no nome de um jogador para ver o perfil completo (histórico, gastos, prêmios)

Para ver o ranking de outra temporada, use o seletor no topo da página.

---

## Dicas

- **Templates de blinds e prêmios** poupam tempo — salve suas estruturas mais usadas
- O **pote override** permite definir um prize pool manual (ignora o cálculo automático)
- A taxa de ranking é descontada automaticamente do pote antes de calcular os prêmios
- Torneios finalizados não aparecem mais como editáveis — confira tudo antes de encerrar

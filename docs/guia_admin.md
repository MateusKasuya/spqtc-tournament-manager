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
- Marque níveis especiais: **Break**, **Nível de Add-on**, **Big Ante**
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

**Timer:**
- **Play/Pause** — controla o tempo do nível atual
- **Avançar nível** — vai para o próximo nível de blinds manualmente
- O timer toca um som ao encerrar cada nível

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

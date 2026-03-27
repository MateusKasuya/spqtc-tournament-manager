# Fase 0.5 — Discussao de Design

Objetivo: alinhar todas as decisoes de design antes de comecar a codificar.
Cada topico tem opcoes, explicacao e uma recomendacao para o contexto SPQC (3-20 jogadores, grupo de amigos, simplicidade).

**Status das decisoes:**
- [x] 1. Versao do Next.js — Opcao A (downgrade para Next.js 15 estavel)
- [x] 2. Autenticacao — Opcao A (email + senha)
- [x] 3. Layout e navegacao — Opcao D (sidebar desktop + bottom nav mobile)
- [x] 4. Sistema de pontuacao/ranking — Opcao D (configuravel pelo admin com presets)
- [x] 5. Distribuicao de premios — Opcao C (tabela fixa com override por torneio)
- [x] 6. Roles e permissoes — Opcao A (Admin + Player, registro aberto)
- [x] 7. Timer realtime — Opcao A (apenas admin controla, sync via Supabase Realtime)

---

## 1. Versao do Next.js

**Situacao atual:** O projeto esta no Next.js 16.2.1-canary.6 (versao instavel/experimental).

**Opcoes:**

| Opcao | Pros | Contras |
|-------|------|---------|
| **A) Downgrade para Next.js 15 estavel** | Estavel, testado, todas as libs compatíveis, mais docs/tutoriais | Nenhum relevante |
| **B) Manter canary 16** | Features mais recentes | Bugs inesperados, libs podem quebrar, pouca documentacao |

**Recomendacao:** Opcao A — downgrade para Next.js 15 estavel. O projeto nao precisa de nada exclusivo do 16, e estabilidade vale mais que novidade aqui.

**Decisao:** Opcao A — Downgrade para Next.js 15 estavel

---

## 2. Autenticacao (Auth)

Autenticacao = como os usuarios fazem login no sistema. O Supabase oferece varias opcoes prontas.

**Opcoes:**

### A) Email + Senha (classico)
- Usuario cria conta com email e senha
- Fluxo: tela de registro -> confirma email -> login
- **Pros:** Simples, todo mundo entende
- **Contras:** Usuarios precisam lembrar mais uma senha; precisa de fluxo "esqueci minha senha"

### B) Magic Link (link magico por email)
- Usuario digita o email, recebe um link por email, clica e esta logado
- Nao precisa de senha
- **Pros:** Sem senha para lembrar, mais seguro (nao tem senha para vazar)
- **Contras:** Depende de acesso ao email na hora; pode ir para spam; mais lento para logar

### C) OAuth com Google
- "Entrar com Google" — um clique
- **Pros:** Mais rapido, sem senha, todo mundo tem Google
- **Contras:** Configuracao extra no Google Cloud Console; depende do Google estar no ar

### D) Registro manual pelo admin + Magic Link
- O admin cadastra os jogadores (nome, email)
- Jogadores recebem um magic link para acessar
- **Pros:** Controle total de quem entra; ideal para grupo fechado
- **Contras:** Admin tem trabalho manual; jogador nao pode se auto-cadastrar

### E) Combinacao: Google OAuth + email/senha como fallback
- Oferece "Entrar com Google" como opcao principal
- Quem nao quer usar Google pode criar conta com email/senha
- **Pros:** Flexivel, cobre todos os casos
- **Contras:** Mais complexo de implementar (dois fluxos)

**Recomendacao:** Opcao A (email + senha) para comecar. E o mais simples de implementar e funciona para um grupo pequeno. Podemos adicionar Google OAuth depois se quiserem. Magic link parece legal mas na pratica irrita porque depende de abrir o email toda vez.

**Decisao:** Opcao A — Email + senha

---

## 3. Layout e Navegacao

Layout = como a tela e organizada. Navegacao = como o usuario vai de uma pagina para outra.

**Opcoes:**

### A) Sidebar fixa (menu lateral)
```
+----------+---------------------------+
| Logo     |                           |
| -------- |     Conteudo principal    |
| Dashboard|                           |
| Torneios |                           |
| Ranking  |                           |
| Jogadores|                           |
+----------+---------------------------+
```
- Menu sempre visivel na lateral esquerda
- **Pros:** Navegacao sempre acessivel, padrao de apps modernos (como Discord, Notion)
- **Contras:** Ocupa espaco horizontal; no celular precisa virar menu hamburguer

### B) Header/Navbar (menu no topo)
```
+-------------------------------------------+
| Logo | Dashboard | Torneios | Ranking | ...|
+-------------------------------------------+
|                                           |
|          Conteudo principal                |
|                                           |
+-------------------------------------------+
```
- Menu horizontal no topo
- **Pros:** Mais espaco vertical; simples
- **Contras:** Com muitos itens fica apertado; menos "app-like"

### C) Bottom navigation (menu embaixo, estilo app mobile)
```
+-------------------------------------------+
|                                           |
|          Conteudo principal                |
|                                           |
+-------------------------------------------+
| Home | Torneios | Timer | Ranking | Mais  |
+-------------------------------------------+
```
- Menu na parte de baixo da tela, como um app nativo
- **Pros:** Otimo para celular (polegar alcanca); moderno
- **Contras:** Nao funciona bem em desktop; limitado a ~5 itens

### D) Sidebar no desktop + Bottom nav no mobile (responsivo)
- No desktop: sidebar lateral
- No celular: menu na parte de baixo
- **Pros:** Melhor experiencia em ambos os dispositivos
- **Contras:** Mais trabalho para implementar (dois layouts)

**Recomendacao:** Opcao D (sidebar + bottom nav). A maioria dos jogadores vai usar pelo celular durante o torneio (ver timer, blinds), mas o admin provavelmente configura pelo computador. Vale o esforco extra.

Se quiser simplificar: Opcao A (sidebar) com menu hamburguer no mobile ja resolve bem.

**Paginas de navegacao:**
- Dashboard (visao geral)
- Torneios (lista + criar novo)
- Ranking (classificacao da temporada)
- Jogadores (lista de jogadores + perfil)
- Relatorios (stats historicos)

**Decisao:** Opcao D — Sidebar desktop + bottom nav mobile

---

## 4. Sistema de Pontuacao / Ranking

Como calcular os pontos que cada jogador ganha por torneio para montar o ranking da temporada.

**Opcoes:**

### A) Pontuacao fixa por posicao
Tabela predefinida baseada no numero de jogadores:

| Posicao | Pontos (exemplo com 10 jogadores) |
|---------|----------------------------------|
| 1o      | 100                              |
| 2o      | 70                               |
| 3o      | 50                               |
| 4o      | 40                               |
| 5o      | 30                               |
| 6o      | 25                               |
| 7o      | 20                               |
| 8o      | 15                               |
| 9o      | 10                               |
| 10o     | 5                                |

- **Pros:** Simples de entender; previsivel
- **Contras:** Nao diferencia torneios com 5 vs 20 jogadores (ganhar com 20 vale o mesmo que com 5)

### B) Pontuacao proporcional ao numero de jogadores
Formula: pontos = f(posicao, total_jogadores)

Exemplo simples: `pontos = (total - posicao + 1) * 10`
- 10 jogadores, 1o lugar = 100 pts
- 10 jogadores, ultimo = 10 pts
- 5 jogadores, 1o lugar = 50 pts

- **Pros:** Torneios maiores valem mais naturalmente
- **Contras:** Um pouco menos intuitivo

### C) Estilo poker (baseado em ligas reais)
Formula inspirada em ligas de poker:
`pontos = sqrt(N) * (N - P + 1) / N * base`

Onde N = numero de jogadores, P = posicao, base = pontuacao base.

- **Pros:** Mais justo matematicamente
- **Contras:** Jogadores nao entendem a formula; dificil de prever

### D) Configuravel pelo admin
O admin define a tabela de pontos para cada temporada (ou usa um preset).

- **Pros:** Flexibilidade total; grupo decide junto
- **Contras:** Mais complexo de implementar; alguem precisa configurar

**Recomendacao:** Opcao B (proporcional) como padrao, com possibilidade de o admin ajustar. E justo, simples de entender ("quanto mais gente, mais pontos"), e resolve o problema de torneios de tamanhos diferentes. Formula sugerida:

```
pontos = ((total_jogadores - posicao + 1) / total_jogadores) * 100
```

Isso da:
- 1o de 10 = 100 pts
- 2o de 10 = 90 pts
- 1o de 5 = 100 pts
- 2o de 5 = 80 pts

O 1o lugar sempre ganha 100, mas o 2o de 5 ganha menos que o 2o de 10 (faz sentido — tinha menos concorrencia).

**Decisao:** Opcao D — Configuravel pelo admin com presets. O admin define a tabela de pontos para cada temporada, podendo usar presets prontos (ex: proporcional, fixo) ou criar sua propria tabela.

---

## 5. Distribuicao de Premios

Como dividir o prize pool (dinheiro total) entre os vencedores.

**Conceito:** Prize pool = soma de todos os buy-ins + rebuys + add-ons. Exemplo: 10 jogadores x R$50 buy-in = R$500 de prize pool.

**Opcoes:**

### A) Percentuais fixos (padrao poker)
Baseado no numero de jogadores:

| Jogadores | 1o   | 2o   | 3o   |
|-----------|------|------|------|
| 3-4       | 100% | -    | -    |
| 5-6       | 70%  | 30%  | -    |
| 7-10      | 50%  | 30%  | 20%  |
| 11-15     | 45%  | 27%  | 18%  | 10% (4o)
| 16-20     | 40%  | 25%  | 18%  | 12% | 5% (5o)

- **Pros:** Padrao da industria; justo; sem discussao
- **Contras:** Inflexivel

### B) Configuravel por torneio
O admin define os percentuais ao criar o torneio.

- **Pros:** Flexivel; o grupo pode decidir
- **Contras:** Mais trabalho; pode dar discussao

### C) Fixo com override
Usa a tabela fixa como padrao, mas permite o admin alterar para um torneio especifico.

- **Pros:** Melhor dos dois mundos — rapido no padrao, flexivel quando precisa
- **Contras:** Um pouco mais complexo na UI

**Recomendacao:** Opcao C (fixo com override). Na maioria das vezes o padrao resolve. Se um dia quiserem fazer algo especial (ex: torneio de natal com premio diferente), o admin pode ajustar.

**Decisao:** Opcao C — Tabela fixa com override por torneio

---

## 6. Roles e Permissoes

Quem pode fazer o que no sistema.

**Opcoes:**

### A) Dois roles: Admin e Player
- **Admin:** Cria/edita/deleta torneios, gerencia jogadores, controla timer, configura tudo
- **Player:** Ve torneios, ve ranking, ve seu perfil, ve timer

### B) Tres roles: Admin, Dealer e Player
- **Admin:** Tudo acima + gerencia temporadas, relatorios
- **Dealer (mesa):** Cria torneios, controla timer, registra eliminacoes (nao gerencia jogadores/temporadas)
- **Player:** Somente leitura

### C) Role unico com permissoes granulares
- Cada usuario tem permissoes individuais (pode_criar_torneio, pode_controlar_timer, etc.)
- **Pros:** Maximo controle
- **Contras:** Complexo demais para um grupo de 3-20 pessoas

**Recomendacao:** Opcao A (Admin + Player). Para um grupo de amigos, dois roles e mais que suficiente. O admin (voce, provavelmente) faz a gestao, os jogadores consultam. Se precisar, qualquer jogador pode virar admin temporariamente.

**Quem pode se registrar?**
- Opcao 1: Qualquer pessoa com o link (registro aberto)
- Opcao 2: Apenas por convite do admin (registro fechado)
- **Recomendacao:** Registro aberto, mas so o admin adiciona jogadores aos torneios. Assim qualquer amigo cria conta, mas nao "invade" torneios.

**Decisao:** Opcao A — Admin + Player, registro aberto

---

## 7. Timer Realtime

O timer de blinds e o coracao do torneio. Ele controla quando os niveis de blinds sobem.

**Como funciona um timer de blinds:**
- Cada nivel tem um tempo (ex: 15 minutos)
- Quando o tempo acaba, as blinds sobem para o proximo nivel
- Entre niveis pode ter um "break" (pausa para descanso)
- O timer precisa ser sincronizado para todos que estao vendo

**Opcoes de controle:**

### A) Apenas admin controla
- So o admin pode iniciar, pausar, avancar ou voltar nivel
- Todos os outros so veem o timer
- **Pros:** Sem confusao; uma pessoa no controle
- **Contras:** Se o admin sair da mesa, ninguem controla

### B) Qualquer jogador do torneio controla
- Qualquer participante pode pausar/iniciar o timer
- **Pros:** Flexivel; qualquer um resolve
- **Contras:** Alguem pode apertar sem querer; bagunca

### C) Admin delega para um "dealer" temporario
- Admin pode dar permissao temporaria para outro jogador controlar o timer daquele torneio
- **Pros:** Flexivel e controlado
- **Contras:** Mais complexo

**Recomendacao:** Opcao A (apenas admin controla) para comecar. Num grupo pequeno, o admin fica na mesa e controla. Simples e sem risco de alguem pausar sem querer.

**Decisao:** Opcao A — Apenas admin controla, sync via Supabase Realtime

**Sincronizacao (como funciona por tras):**
- O estado do timer (rodando/pausado, tempo restante, nivel atual) fica salvo no banco de dados (Supabase)
- Quando o admin aperta play/pause, o banco atualiza
- Todos os dispositivos conectados recebem a atualizacao em tempo real via Supabase Realtime (WebSocket)
- O countdown visual roda no navegador de cada um (nao precisa ficar mandando updates a cada segundo)
- Quando o timer chega a zero, o frontend avanca o nivel e atualiza o banco

**O que aparece na tela do timer:**
- Nivel atual (ex: "Nivel 5")
- Blinds atuais (ex: "100/200 ante 25")
- Tempo restante (ex: "12:45")
- Proximo nivel (ex: "Proximo: 150/300 ante 50")
- Botoes de controle (so para admin): Play, Pause, Proximo nivel, Nivel anterior

---

## Resumo de Recomendacoes

| Topico | Decisao |
|--------|---------|
| 1. Next.js | Downgrade para 15 estavel |
| 2. Auth | Email + senha |
| 3. Layout | Sidebar desktop + bottom nav mobile |
| 4. Pontuacao | Configuravel pelo admin com presets |
| 5. Premios | Tabela fixa com override por torneio |
| 6. Roles | Admin + Player, registro aberto |
| 7. Timer | Apenas admin controla, sync via Supabase Realtime |

---

## Proximos passos

Depois de decidir todos os topicos acima:
1. Atualizar `implementation_plan.md` com as decisoes
2. Detalhar a Fase 1 (Auth) com base nas decisoes
3. Executar Fase 1

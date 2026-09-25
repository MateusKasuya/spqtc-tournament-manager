# Mesa ao vivo: painéis dos cards

Decisões do grilling de 2026-09-25 sobre tornar clicáveis os cards de estatística da Mesa ao vivo. Termos conforme o `CONTEXT.md`. Entrada para `/to-spec` + `/to-tickets`.

## Regras gerais

- Tocar num card abre uma **gaveta**: sobe de baixo no celular, abre na lateral no desktop. Hoje não existe esse componente em `src/components/ui/`.
- Os painéis são **só consulta**. Knockout, Rebuy, add-on, bônus e Desfazer continuam nas Ações rápidas.
- Os painéis são **visíveis para todos** que abrem a mesa, admin e jogadores. Isso vale também para valores por pessoa (Bounty coletado, Prêmios de um acordo), porque a página do torneio já os mostra a quem não é admin.
- **Exceção só para o admin:** um aviso quando a Estrutura de prêmios tem mais Posições premiadas que Participantes com buy-in. A mesa só avisa e não muda nada.
- O rótulo do card "Jogadores" fica. O card "Bounty pool" passa a se chamar **"Bounty em jogo"**.

## Painéis

### Jogadores
1. Cabeçalho, por exemplo "7 em jogo · 12 com buy-in · 5 Eliminações".
2. Lista dos Em jogo:
   - apelido;
   - marcas de Rebuy, add-on e bônus;
   - Bounty, em Bounty Builder.
   A ordem é alfabética, porque o stack de cada um não é registrado.
3. Eliminações, da mais recente para a mais antiga, com a Posição final gravada ("8º Fulano"). Depois da Coroação, o campeão aparece em destaque.
4. Seção "Aguardando buy-in".
5. Linha "faltam N Eliminações para o dinheiro", "Bolha" ou "No dinheiro", com atalho para o painel do Prize pool.

### Stack médio
1. Número em fichas e em BB, por exemplo "1.850 fichas ≈ 23 BB". Usa o big blind do Nível atual; durante um Intervalo, o do Nível de retorno.
2. A conta aberta: Fichas em jogo ÷ N Em jogo, com o aviso "é uma média; o stack de cada um não é registrado".
3. O Stack médio em BB no próximo Nível.

### Fichas em jogo
1. Decomposição: buy-ins × fichas iniciais + Rebuys × fichas de Rebuy + add-ons × fichas de add-on + bônus × fichas de bônus = total. Linhas zeradas ficam escondidas.
2. Nota: "nenhuma ficha sai do jogo; as fichas de quem caiu continuam na mesa".
3. Regras de entrada, por exemplo "Rebuy R$ X → Y fichas, até N por pessoa (ou ilimitado)", mais as de add-on e bônus.

### Prize pool
1. Cascata: Buy-ins + Rebuys + Add-ons = Arrecadado; menos o Fundo de ranking; menos o Bounty armado; igual ao Prize pool. Prêmios pagos e Saldo aparecem só se já houve distribuição.
2. Estrutura de prêmios com % e Prêmio estimado de cada posição, e uma linha marcando até onde paga. Também:
   - o resumo "Pagam 5 · 7 em jogo · faltam 2";
   - na Bolha, um aviso em destaque;
   - No dinheiro, "o próximo a cair termina em 5º e leva R$ X".
3. Depois de um acordo (Distribuir prêmios com o torneio Rodando), os Prêmios acordados aparecem no lugar dos estimados e a Bolha some.

### Bounty em jogo (só Bounty Builder)
1. Bounty de cada Participante em jogo, do maior para o menor, com "derrubar sozinho: R$ X em dinheiro + R$ X no seu Bounty".
2. Bounty coletado de cada Participante, do maior para o menor. O do campeão inclui o próprio Bounty coletado na Coroação.
3. Linha de conferência: "Bounty armado = Bounty em jogo + Bounties coletados".

### Nível (novo: tocar no bloco do Nível/blinds)
- A estrutura de blinds inteira, com o Nível atual marcado.
- Quanto falta para o próximo Intervalo.
- Em que Nível é o add-on.

## Mudanças na face dos cards (valem também para a TV)

- Jogadores: "de N com buy-in" em vez de "de N pagos".
- Stack médio: "≈ N BB".
- Jogadores: "Bolha" ou "faltam N p/ o dinheiro".
- Prize pool: "1º R$ X".

## Dados que a mesa passa a receber

- **Estrutura de prêmios, atualizada ao vivo.** Hoje ela não está na mesa, e a tabela não está na publicação de realtime; precisa de uma migration no padrão da `drizzle/migrations/0004_realtime_blind_structures.sql`.
- **Limite de Rebuys** (`maxRebuys`), junto da configuração do torneio.

## Armadilhas conhecidas (para a spec)

- **Nível de intervalo:** pode ter BB 0. Converter em BB pelo Nível de retorno; sem Nível válido, mostrar "—".
- **0 Em jogo:** Stack médio vira "—".
- **Posição final:** não é única (#71). Filtrar Eliminações por status, nunca pela existência de posição, porque um acordo grava posição também em quem ainda está Em jogo (`src/actions/participants.ts:467`).
- **Prêmio estimado:** usar sempre o arredondamento existente (`calculateRoundedPrizeAmounts`), nunca % × Prize pool.
- **Um cálculo, dois lugares:** o card e o painel precisam usar a mesma derivação de Fichas em jogo e Stack médio.
- **Campeão reversível:** o Desfazer pode descoroar. O destaque do campeão tem de vir sempre dos dados da mesa.

## Fica para depois

- Knockouts por Eliminador (+0,25 ponto de ranking).
- Lista dos últimos Knockouts.
- "Eliminado por X".
- Horário de cada Eliminação.
- Calculadora "minhas fichas → BB".
- Painel do add-on.
- "Subir de posição vale +R$ X".
- Stack inicial e Rebuy em BB.

## Fora de escopo

- **M e chip leader:** a app não sabe quantas mesas existem nem registra o stack de cada um.
- **Acordo por ICM:** também depende do stack de cada um.
- **Denominações das fichas e color-up:** não são modeladas.

## Bugs encontrados (issues com `needs-triage`)

- #71: Posição final repetida ao desfazer Eliminação fora de ordem.
- #72: o servidor aceita bônus para quem está Aguardando buy-in.
- #73: Saldo negativo ao desfazer buy-in, Rebuy ou add-on depois de Distribuir prêmios.
- #74: editar o torneio não respeita o Status do torneio no servidor.

## Em aberto

- **Depois de um acordo, o SPQC encerra na hora ou continua jogando até a Coroação?**
  - Se continua, a posição do acordo e a de quando cada um cai de fato divergem, e o ranking usa a última. Vira uma issue para decidir qual posição vale para o ranking.
  - Não muda os painéis, que mostram a posição gravada.

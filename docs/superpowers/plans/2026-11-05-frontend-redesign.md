# Frontend: nova direção visual (substitui o "Brief de design" do plano da fundação)

> Origem: 8 capturas de referência que o cliente colocou na pasta `Documents\último projeto integrado` (cards de funcionalidades com barra colorida, CRM Spinoto, Gestão de Frota, check-in com diagrama do carro, ShopBoss, kanban de oficina, dashboard roxo, portal Repairius Auto). **Estas referências substituem a direção "oficina industrial" anterior** (paleta concreto/chassi/oleo, sem cards, sem sombras). O que vale do plano antigo: estrutura de arquivos, tarefas F3 (API/auth), regras de acessibilidade e de texto (pt-BR, verbos claros).

## O que o cliente quer (lido das referências)

1. **Cards brancos de cantos bem arredondados** com sombra suave e uma **barra de cor curta no topo** (ref. 1); cada funcionalidade em um card.
2. **App shell de SaaS moderno:** barra lateral (navy escuro, ref. 3) com seções agrupadas e item ativo em pílula; topo com breadcrumb, busca com atalho ⌘K, notificações e avatar (ref. 2).
3. **Tabelas limpas:** busca + filtros acima, checkbox, colunas ordenáveis, pílulas de status coloridas, avatar com iniciais, menu "⋯" por linha, rodapé com "Linhas por página" e paginação (refs 2 e 3).
4. **Check-in/inspeção** com **diagrama do carro visto de cima** (marcadores de avaria clicáveis) e lista de itens com semáforo **Trocar agora (vermelho) / Trocar em breve (amarelo) / Ok (verde)** e botão "Tudo ok" (ref. 4).
5. **Quadro kanban de ordens de serviço** com colunas de cor suave por status e cards de ordem (foto do carro, status em pílula com seletor, cliente, veículo, placa, defeito, mecânico, valor) (ref. 6); também visão em lista com ponto colorido de status (ref. 5).
6. **Dashboard** com KPIs (valor + tendência), gráfico de linha, mini-donuts de progresso, cards de serviços em andamento, agenda do dia, mecânicos ativos (ref. 7).
7. **Detalhe do veículo** estilo Repairius: cartão do veículo com km, **alerta "Próximo serviço: troca de óleo em 1.200 km"**, **histórico de serviços em linha do tempo** com ícones redondos, painel lateral com ações e resumo (ref. 8). Isso é exatamente o motor de manutenção preventiva do projeto.

## Tokens (substituem os anteriores)

| Token | Hex | Uso |
|---|---|---|
| `navy` | `#10194A` | barra lateral, títulos fortes, botão escuro |
| `navy-2` | `#1B2766` | hover/itens da barra lateral |
| `azul` | `#2457E6` | ação principal, links, foco, item ativo |
| `menta` | `#14C9A4` | CTA de destaque (ref. 1), "ok"/positivo suave |
| `fundo` | `#F4F6FB` | fundo do app |
| `superficie` | `#FFFFFF` | cards, tabelas, diálogos |
| `tinta` | `#141B34` | texto principal |
| `tinta-suave` | `#5A6482` | texto secundário (>= 4.5:1 sobre `fundo` e `superficie`) |
| `linha` | `#E3E7F1` | bordas de 1 px |
| `borda-campo` | `#8C96B2` | borda de inputs (>= 3:1 sobre `superficie`) |
| `ok` / `ok-texto` / `ok-fundo` | `#1FA971` / `#13744D` / `#E3F6EE` | status ok (texto pequeno usa `ok-texto`) |
| `atencao` / `atencao-texto` / `atencao-fundo` | `#F2A20C` / `#8A5A00` / `#FFF3D6` | em breve / aviso |
| `critico` / `critico-texto` / `critico-fundo` | `#E5484D` / `#B3262B` / `#FDE8E9` | crítico / erro |
| `info-fundo` | `#E8EEFF` | pílula informativa |

Cores de acento por funcionalidade (barra no topo do card, ref. 1): azul `#2457E6`, menta `#14C9A4`, violeta `#6B3FE0`, ciano `#0E8FB0`, laranja `#F2711C`, rosa `#D9468F`. Cores de coluna do kanban (fundo suave): azul `#EAF0FF`, verde `#E5F6EE`, laranja `#FFF0E1`, cinza `#EEF0F6`.

**Contraste:** todo texto >= 4.5:1; testes automáticos de razão WCAG continuam no `tokens.test.ts` (atualizar com os novos pares). Cores `ok/atencao/critico` puras só como ponto, barra ou ícone; texto usa as variantes `-texto`.

## Tipografia

**Inter** (variável via `@fontsource-variable/inter`, latin + latin-ext) para tudo: é a fonte das referências e funciona muito bem em tabelas e números (`font-variant-numeric: tabular-nums`). Títulos de página 28/700, títulos de card 18/650, corpo 14–15/400, rótulos de tabela 13/600. Placa e valores grandes dos KPIs podem usar **Barlow Condensed 700** (já instalada) para dar identidade automotiva; só nesses dois lugares.

## Forma e movimento

- Cards: raio **16 px**, sombra `0 1px 2px rgba(16,25,74,.06), 0 8px 24px rgba(16,25,74,.06)`, borda `linha`. Diálogos: raio 20 px. Campos e botões: raio 10 px. Pílulas de status: totalmente arredondadas, pequenas, com ponto colorido.
- Barra lateral navy, 264 px (recolhível para 76 px só com ícones), item ativo em pílula `azul`; seções com rótulo em sentence case.
- Movimento só em resposta a ação (hover de card sobe 2 px, diálogo, toast, drag no kanban) e uma entrada leve na tela de login; respeitar `prefers-reduced-motion`.
- Ícones: um único conjunto consistente (usar `lucide-react`), 20 px, traço 1.75.
- Gráficos: SVG próprio simples ou `recharts`, cores da paleta, sem gradientes chamativos.

## Marca

"Auto Center" com um ícone próprio simples (engrenagem/chave estilizada em SVG) em `azul` sobre navy. Sem logos de terceiros.

## Tarefas (ordem)

- **F3** (em andamento): API, autenticação, login (lógica e testes; o visual será refeito).
- **R1: Re-skin do sistema de design.** Trocar `tokens.css` pelos tokens acima, instalar Inter variável e `lucide-react`, atualizar `tokens.test.ts` (nomes, hex, contraste), refazer o visual de todas as primitivas de `src/shared/ui` (Button com variantes azul/menta/navy/contorno/perigo; Input com ícone opcional; Select; Badge/StatusPill com ponto; **Card** novo com barra de acento opcional; **Avatar** com iniciais; **StatCard**; **Tabs**; **Toolbar de tabela**; Table com cabeçalho cinza claro, checkbox, ordenação visual, menu ⋯; Pagination com "Linhas por página"; Plate; Dialog; Toast; EmptyState; Skeleton; Logo). Manter toda a acessibilidade e os testes existentes passando (ajustando seletores de classe se necessário). Refazer o **LoginPage** no novo visual (painel esquerdo navy com marca e frase, direito branco com o formulário em card; mobile compacto).
- **F4: Shell + Início.** Barra lateral navy agrupada, topo com breadcrumb + busca ⌘K (abre paleta de comandos que navega só para módulos existentes) + avatar/menu. **Início:** saudação, estado da API e **um card por funcionalidade** (barra de acento colorida, ícone, título, descrição de uma linha, lista de 3 itens com check como na ref. 1, botão; módulos ainda sem backend = "Em breve", sem link, sem números inventados).
- **F4b: Cards do dashboard com dados de exemplo (decisão do cliente: "coloque os cards mesmo assim").** Na Início, abaixo dos 8 cards de funcionalidade, colocar os cards de dashboard das refs 7/8, **todos alimentados por `src/features/dashboard/demo-data.ts`** (único lugar com números de exemplo, nomes e placas fictícios plausíveis, nunca dados reais de pessoas): KPIs (faturamento do mês, ordens abertas, veículos na oficina, estoque crítico, cada um com tendência), gráfico de linha de faturamento (SVG próprio ou recharts), mini-donuts de progresso (peças, insumos, mão de obra), cards de serviços em andamento (placa com `Plate`, serviço, mecânico, prazo, barra de progresso), agenda do dia (lista com horário, cliente, veículo, placa), mecânicos ativos (avatar, função, status), alertas de manutenção (troca de óleo vencida, rodízio próximo, revisão, estoque crítico) e linha do tempo de um veículo de exemplo com "Próximo serviço". **Cada card de exemplo mostra a etiqueta visível "Dados de exemplo"** (componente `SampleDataTag`), e o arquivo `demo-data.ts` começa com um comentário explicando que será substituído pela API. Nenhum desses dados é enviado ao backend nem persistido.
- **F5: Usuários** no novo visual (tabela estilo refs 2/3, busca + filtro por perfil + paginação, avatar, pílula de perfil e estado, criar/editar em diálogo, excluir com confirmação).
- **Depois, junto de cada plano de backend:** Clientes, Veículos (lista + detalhe estilo ref. 8 com próximo serviço e histórico em linha do tempo), Check-in (diagrama do carro + semáforo, ref. 4), Ordens de serviço (kanban + lista, ref. 6/5), Dashboard e Alertas (ref. 7), Saúde do veículo (nota 0–100).

## R3: PC e celular (pedido do cliente: "próprio para PC e otimizado para o celular")

Critérios obrigatórios, verificados em 1920, 1440, 1024, 768 e 390 px (e 360):
- **PC:** conteúdo com largura máxima confortável (≈1280–1440 px) centrada na área útil, tabelas densas com cabeçalho fixo e ações por linha, atalhos de teclado (Ctrl+K já existe; `Esc`, setas), foco visível, hover.
- **Celular (um polegar):** sem rolagem horizontal da página; barra de navegação inferior fixa com 4 atalhos + "Mais" (Início, Veículos, Ordens, Check-in; somente módulos disponíveis para o perfil) no lugar da barra lateral em < 768 px, respeitando `env(safe-area-inset-*)`; alvos de toque ≥ 44 px; tabelas viram **listas de cards empilhados** (nome/placa em destaque, status em pílula, ação "⋯"); formulários em coluna única com `inputmode`/`autocomplete`/`enterkeyhint` corretos (e-mail, telefone, numérico para km, placa em maiúsculas); diálogos viram **bottom sheet** em < 640 px; tipografia ≥ 16 px em campos (evita zoom do iOS); `viewport-fit=cover`; `theme-color` navy.
- **Tablet na bancada (768–1024):** barra lateral recolhida em ícones, tabelas e kanban com rolagem horizontal contida e alvos grandes.
- **Instalável (PWA leve):** `manifest.webmanifest` (nome, ícones gerados do Logo em 192/512, `display: standalone`, cores da paleta) e `<meta name="theme-color">`; **sem** service worker de cache de dados da API (evita dado velho e problemas de segurança), no máximo cache dos arquivos estáticos do app.
- **Desempenho:** divisão de código por rota (`React.lazy`), imagens/ícones leves, fontes só com os subconjuntos usados; meta de LCP < 2,5 s em 4G simulado e bundle inicial enxuto (reportar tamanhos do build).
- Teste visual em navegador real nos 5 tamanhos para: login, Início (cards + dashboard), Usuários; corrigir tudo que quebrar; testes de unidade para os componentes responsivos (barra inferior, bottom sheet, lista de cards) e para o roteamento por perfil na barra inferior.

## Revisão contra o genérico

Esta direção é deliberadamente o padrão "SaaS moderno" porque é o que o cliente pediu com as referências; a identidade vem de: placa Mercosul, hodômetro/nota de saúde, linha do tempo de manutenção, semáforo de inspeção e o diagrama do carro. Tudo isso é conteúdo real do domínio, não enfeite.

# Frontend Foundation (Plano 2 de 5) — design + login + shell + usuários

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Cada tarefa tem critérios de aceite e testes obrigatórios; o código de UI é escrito pelo implementador seguindo o brief de design abaixo (não há código colado, de propósito: é trabalho de design).

**Goal:** Entregar a base do frontend do Auto Center, bonita e profissional, ligada à API real (login, estrutura do app, gestão de usuários). Cada módulo novo do backend ganha sua tela depois.

**Stack:** Vite + React 18/19 + TypeScript (strict) + Tailwind CSS + React Router + TanStack Query + Vitest + Testing Library + MSW (mock só nos testes). Fontes self-hosted via `@fontsource` (sem CDN).

**API:** `http://127.0.0.1:8000/api/v1` (variável `VITE_API_URL`). Envelope de erro `{"error": {"code","message","details?"}}`. Login: `POST /auth/login {email,password}` → `{access_token, token_type}`; `GET /auth/me`; `/users` (admin): `GET ?page&size&q` → `{items,total,page,size}`, `POST`, `GET/PATCH/DELETE /{id}`. Perfis: `admin`, `reception`, `mechanic`.

---

## Brief de design (decisões, não sugestões)

**Assunto:** sistema interno de uma oficina. Usado o dia todo por recepção, mecânicos e dono, em PC de balcão e tablet na bancada. Mãos sujas, luz forte, pressa: legibilidade e alvos de toque grandes (≥ 40 px) valem mais que enfeite.

**Vernáculo da oficina que vira design:** placa Mercosul (identificador nº 1 de um carro), pintura de baia no piso (linha tracejada âmbar), etiqueta de ordem de serviço pendurada no retrovisor, hodômetro. Nada de "SaaS roxo", nada de bege + terracota, nada de preto + verde-ácido.

**Paleta (nomes de oficina):**

| Token | Hex | Uso |
|---|---|---|
| `concreto` | `#E7EAEB` | fundo do app |
| `bancada` | `#F8F9F9` | superfícies (tabelas, diálogos, campos) |
| `chassi` | `#15262D` | tinta do texto, barra lateral |
| `esmalte` | `#0E5A6B` | ação principal, foco, links |
| `oleo` | `#D68A00` | atenção, linha de baia, "próximo de vencer" |
| `freio` | `#BF3B2D` | erro, crítico, ações destrutivas |
| `sinal` | `#2E7A4D` | ok, concluído |
| `risco` | `#C9D0D2` | linhas e bordas de 1 px |

Texto secundário = `chassi` a 68% de opacidade (verificar contraste AA ≥ 4.5:1 sobre `concreto` e `bancada`; ajustar se falhar). Sem gradientes decorativos.

**Tipografia:** **Barlow Condensed** (600/700) para títulos, números e a marca: remete a sinalização viária/placa. **IBM Plex Sans** (400/500/600) para texto e campos, 15 px base, `tabular-nums` em tabelas. Escala: 13 / 15 / 17 / 22 / 30 / 44 (títulos condensados em 22+). Linhas de texto ≤ 70 caracteres. Rótulos em *sentence case*; **proibido**: eyebrows em caixa-alta espaçada, "palavra — fragmento", destaque de uma única palavra em título, numeração 01/02/03 sem sequência real, "→" em todo botão.

**Forma:** raios diferentes por papel (placa 6, campos 4, diálogos 10, avatar redondo); sem sombra em cards (usar linha de 1 px `risco`); sombra só em diálogo e menu. Linhas de tabela têm uma **barra de status de 3 px à esquerda** (como etiqueta), codificando o estado (ex.: usuário inativo = `risco`, admin = `esmalte`). Nada de grade de cards idênticos: listas e tabelas primeiro.

**O elemento memorável (gaste a ousadia aqui):** o componente **`<Plate>`** (placa Mercosul: fundo branco, faixa azul superior com "BRASIL", caracteres em Barlow Condensed, 3 letras + 1 número + 1 letra + 2 números) e a **linha de baia** âmbar tracejada usada como divisor de seção e no painel da tela de login. O resto fica quieto.

**Movimento:** apenas em resposta a ação (diálogo abre/fecha, toast, linha criada/removida, botão com estado de carregando) e **uma** entrada orquestrada na tela de login. Respeitar `prefers-reduced-motion`. Sem fade-up em cada seção.

**Layout:**

```
Desktop                                   Tablet/mobile (< 900px)
+------+--------------------------+      +--------------------------+
| rail | topo: título · usuário   |      | topo + botão menu        |
| (chassi) |-------------------------|      |--------------------------|
| Início|  conteúdo (máx 1200px)  |      | conteúdo                 |
| Usuários|  alinhado à esquerda  |      | menu abre como gaveta    |
+------+--------------------------+      +--------------------------+
```

Rail estreita (72 px, ícone + rótulo curto embaixo) em `chassi`, item ativo com barra `oleo` à esquerda. Conteúdo alinhado à esquerda (nunca centralizado), títulos de página em Barlow Condensed 30. Tela de login: painel esquerdo `chassi` com a marca e a linha de baia vertical; direito `bancada` com o formulário.

**Textos (pt-BR, voz direta, sem pedir desculpa):** botões dizem o que fazem ("Entrar", "Criar usuário", "Salvar alterações", "Desativar"), e o toast repete o verbo ("Usuário criado"). Erros dizem o que houve e como resolver ("E-mail já cadastrado. Use outro e-mail ou edite o usuário existente."). Estados vazios convidam a agir.

**Qualidade mínima (sem anunciar):** responsivo até 360 px, foco de teclado sempre visível (anel `esmalte` 2 px + offset), labels associados a campos, `aria-live` nos toasts, contraste AA, diálogos com foco preso e `Esc` fecha, tabelas com `<th scope>`.

**Revisão contra o genérico (feita):** primeira ideia era "painel escuro com cards de KPI e acento neon" → descartada por ser o padrão de qualquer dashboard. Trocada por: listas/tabelas primeiro, placa como identificador, linha de baia como motivo, paleta de esmalte/óleo/freio que sai do próprio assunto.

---

## Estrutura de arquivos

```
frontend/
  package.json  tsconfig*.json  vite.config.ts  index.html  .env.example  .gitignore
  src/
    main.tsx  app/{App.tsx,router.tsx,providers.tsx}
    styles/{index.css,tokens.css}                # @theme do Tailwind + fontes
    shared/
      api/{client.ts,errors.ts,types.ts}
      ui/{Button,Input,Field,Select,Badge,Plate,Dialog,ConfirmDialog,Toast,Table,Pagination,Skeleton,EmptyState,Logo,BayLine}.tsx
      hooks/{useDebounce.ts}
    features/
      auth/{AuthProvider.tsx,useAuth.ts,LoginPage.tsx,RequireAuth.tsx,RequireRole.tsx,storage.ts}
      shell/{AppShell.tsx,Rail.tsx,Topbar.tsx,HomePage.tsx,NotFoundPage.tsx}
      users/{api.ts,UsersPage.tsx,UserFormDialog.tsx,roleLabels.ts}
    test/{setup.ts,server.ts,handlers.ts}
```

---

## Tarefas

Cada tarefa termina com `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passando, commit com trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, arquivos em UTF-8 **sem BOM**, sem push.

### F1: Scaffold, tokens e fontes
- Criar `frontend/` com Vite + React + TS strict, Tailwind, React Router, TanStack Query, Vitest + Testing Library + MSW, ESLint, `typecheck` script. `.env.example` com `VITE_API_URL=http://127.0.0.1:8000/api/v1`. `.gitignore` do frontend (node_modules, dist, .env*).
- `tokens.css`: tokens da paleta/tipografia/raios acima via `@theme`; fontes `@fontsource/barlow-condensed` (600,700) e `@fontsource/ibm-plex-sans` (400,500,600).
- Página de teste só em dev não é necessária. **Teste:** renderizar `<App/>` mostra a marca; um teste unitário garante que os tokens existem em `tokens.css` (nomes das 8 cores).
- **Aceite:** `npm run dev` abre em `http://localhost:5173` com fundo `concreto` e fontes carregando localmente.

### F2: Primitivas de UI (sistema de design)
- Componentes: `Button` (primário/secundário/perigo/fantasma, estado `loading`, tamanho de toque ≥ 40px), `Input`/`Field` (label, ajuda, erro, `aria-describedby`), `Select`, `Badge` (ok/atenção/crítico/neutro/info), **`Plate`** (valida formato Mercosul e antigo `AAA-0000`; formata maiúsculas), `Dialog` + `ConfirmDialog` (foco preso, Esc, `role=dialog`), `Toast` (provider + `aria-live`), `Table` (cabeçalho `th scope`, barra de status por linha), `Pagination`, `Skeleton`, `EmptyState`, `Logo`, `BayLine` (horizontal/vertical, tracejado âmbar).
- **Testes:** Button não dispara com `loading`; Field liga label↔input e mostra erro com `aria-invalid`; Dialog fecha com Esc e devolve foco; Plate normaliza `abc1d23`→`ABC1D23` e rejeita formato inválido; Toast é anunciado (`role=status`).
- **Aceite:** respeita `prefers-reduced-motion`; foco visível em todos.

### F3: Cliente de API e autenticação
- `client.ts`: fetch com base URL, `Authorization: Bearer`, parse do envelope de erro em `ApiError {status, code, message, details}`; 401 em rota autenticada → limpa sessão e redireciona para `/entrar` preservando destino.
- `AuthProvider`: token em `sessionStorage` (decisão: some ao fechar a aba; documentar), `login()`, `logout()`, carrega `/auth/me` ao iniciar, expõe `user` e `can(role[])`.
- `LoginPage` (rota `/entrar`): painel esquerdo `chassi` com `Logo` + `BayLine` vertical, direito com formulário; validação no cliente (e-mail, senha obrigatória); erro de credencial mostra "E-mail ou senha incorretos." sem revelar qual; **uma** animação de entrada orquestrada.
- `RequireAuth`, `RequireRole` (perfil sem acesso → página "Sem permissão" com caminho de volta).
- **Testes (MSW):** login ok guarda token e vai ao destino; senha errada mostra a mensagem; token expirado (401 em `/auth/me`) volta ao login; `RequireRole` bloqueia mecânico em `/usuarios`; logout limpa tudo.

### F4: Shell do app e página inicial
- `AppShell`: rail (≥ 900px) e gaveta (< 900px), `Topbar` com título da página, nome/perfil do usuário e menu "Sair". Navegação mostra **só módulos que existem**: Início e, para admin, Usuários. Sem links mortos, sem busca fantasma.
- `HomePage`: saudação por horário ("Bom dia, {primeiro nome}"), o perfil do usuário e o que ele pode fazer hoje (lista curta por perfil), estado da API (`/health`: "API online"), e `EmptyState` honesto: "Os módulos de veículos e ordens de serviço chegam nas próximas etapas." sem números inventados. `NotFoundPage`.
- **Testes:** admin vê "Usuários" no menu, recepção não; gaveta abre/fecha por teclado; saudação muda com o horário (relógio fake).

### F5: Gestão de usuários
- `UsersPage` (admin): tabela com busca (debounce 300 ms, `q`), paginação (`page`,`size`=10), colunas nome/e-mail/perfil/estado, barra de status por linha, ações por linha (Editar, Desativar/Ativar, Excluir com `ConfirmDialog`), botão "Criar usuário".
- `UserFormDialog`: criar (nome, e-mail, perfil, senha 8–72) e editar (nome, perfil, ativo, nova senha opcional); erros do servidor mapeados aos campos (`details[].loc`) e erros de regra no topo do diálogo; o admin logado não pode desativar/rebaixar/excluir a si mesmo (botões desabilitados com explicação, além do bloqueio do backend).
- Estados: carregando (Skeleton), vazio ("Nenhum usuário encontrado. Limpe a busca ou crie o primeiro."), erro de rede com "Tentar de novo". TanStack Query invalida a lista após mutações; toasts "Usuário criado/atualizado/desativado/excluído".
- **Testes (MSW):** lista pagina e busca; criar com e-mail duplicado mostra 409 amigável; editar muda perfil; excluir pede confirmação; o próprio admin não consegue se excluir.

### F6: Qualidade, CI e README
- Verificação visual no navegador real (Chrome) contra a API local em `http://127.0.0.1:8000`: login, shell, usuários em 1280, 768 e 390 px; corrigir o que estiver feio ou quebrado; checar foco por teclado.
- `frontend/README.md` (como rodar, variáveis, estrutura, decisões de design e de sessão).
- Acrescentar job `frontend` ao `.github/workflows/ci.yml` (Node 22, `npm ci`, lint, typecheck, test, build; `working-directory: frontend`).
- **Aceite:** CI verde com os dois jobs; `npm run build` gera `dist/` sem avisos relevantes.

---

## Self-review

Cobertura do design aprovado: React/TS/Vite/Tailwind/Router/Query (F1), RBAC no cliente (F3, F4), usuários com permissões por perfil (F5), responsivo e acessível (F2, F6), CI (F6). Módulos de negócio (clientes, veículos, check-in, OS, alertas, saúde) ficam para os planos de backend 3 e 4, cada um com sua tela. Nomes consistentes: rota de login `/entrar`, usuários `/usuarios`, token em `sessionStorage` (F3 define, F4/F5 usam via `useAuth`).

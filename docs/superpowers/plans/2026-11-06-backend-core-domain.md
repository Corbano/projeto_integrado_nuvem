# Backend: domínio principal (clientes, veículos, km, check-in, ordens de serviço)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. O backend já tem os padrões estabelecidos (Plano 1): **siga exatamente os mesmos padrões do módulo de usuários** (leia `backend/app/domain/user.py`, `application/services/user_service.py`, `application/dtos/user.py`, `infrastructure/db/models/user.py`, `infrastructure/repositories/user_repository.py`, `presentation/routers/users.py`, `presentation/deps.py`, `tests/test_users_api.py`, `tests/conftest.py`, `migrations/versions/0001_create_users.py`). Esta é uma especificação de comportamento; o código é escrito pelo implementador com TDD.

**Design de referência:** `docs/superpowers/specs/2026-11-05-auto-center-design.md` (entidades e DER).

## Padrões obrigatórios (valem para todas as tarefas)

- Camadas: `domain` (entidade `@dataclass` + `Protocol` de repositório + regras puras) → `application` (service, DTOs Pydantic, ports) → `infrastructure` (modelo SQLAlchemy 2.x, repositório SQL, S3) → `presentation` (router, deps). `domain`/`application` **nunca** importam infraestrutura/apresentação.
- Modelos usam `Base`, `TimestampMixin` e (quando aplicável) `SoftDeleteMixin`; migração Alembic **nova e numerada em sequência** (`0002_...`, `0003_...`), escrita à mão, com `downgrade`; o teste de migração existente deve continuar passando e **cada migração nova tem teste de upgrade/downgrade** (estender `tests/test_migrations.py`).
- Repositório: só retorna entidades de domínio; filtra `deleted_at IS NULL`; `add/update` fazem rollback e levantam `ConflictError` em `IntegrityError`; busca com escape de `%`/`_`; paginação `list_page(offset, limit, ...) -> (items, total)`.
- Services devolvem DTOs `*Out`; erros de negócio usam `NotFoundError`, `ConflictError`, `BusinessRuleError`, `PermissionDeniedError` (envelope de erro já existe).
- Routers em `/api/v1/<recurso>`, `Query(page>=1, <=1_000_000; size 1..100)`, respostas `Page[T]`, `204` sem corpo no DELETE, soft delete.
- Auditoria: tabelas principais têm `created_by_id` e `updated_by_id` (nullable, FK `users.id`), preenchidas pelo service com o usuário autenticado (passar `actor_id`).
- RBAC (usar `require_roles`): salvo indicação, **admin e recepção** escrevem; **mecânico** só lê.
- Testes de API usam as fixtures existentes (`client`, `auth_header`, `make_user`); cada tarefa cobre: caminho feliz, validação (422), duplicidade (409), 404, permissão (403/401), paginação/busca, soft delete.
- Sem credenciais no código. UTF-8 sem BOM (usar Write/Edit; no PowerShell nunca `Out-File`/`Set-Content`). Sem push. Commits pequenos com trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (segundo `-m`) e **caminhos explícitos** no `git add`/`git commit`.
- Gates por tarefa: `cd backend; .\.venv\Scripts\python -m pytest -q` e `.\.venv\Scripts\ruff check .` verdes. Atualizar o `backend/README.md` (seção de endpoints) ao final de cada tarefa.

---

## B1: Clientes

**Tabela `customers`:** `id`, `name` (2–120), `document` (CPF ou CNPJ, só dígitos armazenados, único entre não excluídos), `phone` (10–11 dígitos, opcional), `email` (opcional, normalizado minúsculo), `notes` (texto, opcional), timestamps, `deleted_at`, `created_by_id`, `updated_by_id`. Índices em `name` e `document`.

**Regras:** validar CPF/CNPJ com dígitos verificadores (função pura em `domain`, com testes de casos válidos/ inválidos/ todos-dígitos-iguais); aceitar entrada com máscara (`123.456.789-09`) e normalizar. `document` duplicado entre não excluídos → 409. Exclusão lógica **bloqueada** (422 `business_rule_violation`, "Cliente possui veículos cadastrados") se houver veículos ativos (a verificação é ligada na B2; em B1 deixe o gancho no service via método do repositório `has_vehicles(customer_id)` retornando `False` até a B2, com teste).

**Endpoints:** `GET /customers` (`page,size,q` busca nome/documento/telefone/e-mail), `POST`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`. Escrita: admin+recepção; leitura: todos os perfis autenticados.

**Testes:** CPF/CNPJ válidos e inválidos, máscara normalizada, duplicado 409, busca por parte do nome e do documento sem máscara, mecânico lê mas não escreve (403), soft delete e 404 depois, auditoria (`created_by_id` = usuário que criou), migração 0002 sobe e desce.

## B2: Veículos

**Tabela `vehicles`:** `id`, `customer_id` (FK `customers.id`, obrigatório), `plate` (único entre não excluídos, normalizada maiúscula sem hífen, validar formato antigo `AAA9999` e Mercosul `AAA9A99`), `brand`, `model`, `year` (1950..ano atual+1), `engine` (opcional), `fuel` (enum `gasolina|etanol|flex|diesel|gnv|eletrico|hibrido`), `color`, `chassis` (VIN 17 caracteres sem I,O,Q, opcional, único entre não excluídos quando informado), `renavam` (opcional, 9–11 dígitos), `current_km` (inteiro >= 0, padrão 0), timestamps, `deleted_at`, `created_by_id`, `updated_by_id`. Índices em `plate`, `customer_id`.

**Regras:** placa e chassi duplicados → 409; cliente inexistente/excluído → 404 no cadastro; trocar `customer_id` permitido (transferência) só para admin+recepção. `current_km` **não é editável via PATCH** (só via B3). Ligar `has_vehicles` da B1 (cliente com veículo ativo não pode ser excluído).

**Endpoints:** `GET /vehicles` (`page,size,q` busca placa/marca/modelo, filtro `customer_id`), `POST`, `GET /{id}` (inclui dados resumidos do cliente), `PATCH /{id}`, `DELETE /{id}`, `GET /customers/{id}/vehicles`. Permissões como B1.

**Testes:** placa antiga e Mercosul válidas/inválidas e normalização (`abc-1234`→`ABC1234`), duplicidade de placa/chassi, ano inválido, fuel inválido, `current_km` ignorado no PATCH, filtro por cliente, busca por placa parcial, exclusão do cliente bloqueada enquanto houver veículo (e liberada após excluir o veículo), migração 0003.

## B3: Quilometragem

**Tabela `km_readings`:** `id`, `vehicle_id` (FK), `km`, `source` (`manual|checkin|service_order`), `note` (opcional), `recorded_by_id` (FK users), `created_at`. Índice `(vehicle_id, created_at)`.

**Regras:** novo `km` **não pode ser menor** que `vehicles.current_km` (422 `business_rule_violation`, "A quilometragem não pode diminuir"); igual é aceito sem criar leitura duplicada (idempotente, retorna a última). Ao registrar, atualiza `vehicles.current_km` **na mesma transação**. Correção administrativa: `admin` pode enviar `force=true` com `note` obrigatória para diminuir (registra leitura com a nota). Função de domínio pura `validate_km_update(current, new, is_admin_force)` com testes.

**Endpoints:** `POST /vehicles/{id}/km` (admin+recepção+mecânico), `GET /vehicles/{id}/km` (histórico paginado, mais recente primeiro).

**Testes:** aumento ok, diminuição bloqueada, igual idempotente, `force` só admin e exige nota, transação (falha não altera `current_km`), histórico paginado e ordenado, veículo inexistente 404, migração 0004.

## B4: Check-in com fotos (S3)

**Tabelas:** `checkins` (`id`, `vehicle_id`, `user_id`, `km`, `fuel_level` enum `vazio|quarto|meio|tres_quartos|cheio`, `damages` texto, `accessories` texto, `notes` texto, `created_at`, `created_by_id`), `checkin_checklist_items` (`id`, `checkin_id`, `item` enum `pneus|suspensao|freios|iluminacao|bateria|ar_condicionado|limpadores`, `condition` enum `ok|atencao|critico`, `note`), `checkin_photos` (`id`, `checkin_id`, `storage_key`, `content_type`, `size_bytes`, `created_at`). Um checklist item por (`checkin`, `item`).

**Regras:** `POST /checkins` cria o check-in com o checklist completo (os 7 itens obrigatórios) e **registra a quilometragem** via o service de B3 (mesma transação; km menor que o atual → 422). Mecânico não cria check-in (admin+recepção). Fotos: máx. 10 por check-in, `image/jpeg|png|webp`, máx. 8 MB cada.

**Armazenamento:** porta `FileStorage` em `application/ports.py` (`presign_upload(key, content_type, max_bytes) -> PresignedUpload`, `presign_download(key) -> str`, `delete(key)`), implementações `S3FileStorage` (boto3; bucket e região por `Settings`: `s3_bucket`, `s3_region`; credenciais pela **role da instância**/cadeia padrão do boto3, nunca no código) e `LocalFileStorage` (dev/testes: salva em `backend/.storage/` ignorado pelo git, URLs de demonstração), escolhida por `Settings.storage_backend` (`local|s3`; em produção sem bucket a aplicação **não inicia**). Fluxo: `POST /checkins/{id}/photos/presign` (valida tipo/tamanho, devolve URL de upload + `photo_id`/`storage_key`), cliente envia direto ao S3, `POST /checkins/{id}/photos/{photo_id}/confirm` registra a foto; `GET /checkins/{id}` devolve fotos com URL de download assinada de curta duração (15 min). Chaves de objeto no formato `checkins/{checkin_id}/{uuid4}.{ext}` (nunca derivadas do nome do arquivo do usuário).

**Endpoints:** `POST /checkins`, `GET /checkins` (filtros `vehicle_id`, paginação), `GET /checkins/{id}`, as 2 de fotos e `DELETE /checkins/{id}/photos/{photo_id}` (admin+recepção).

**Testes:** criação com 7 itens (faltando/duplicado → 422), km atualizado, km menor bloqueado e check-in não criado, mecânico 403, limite de fotos, tipo/tamanho inválidos, presign usa `LocalFileStorage` nos testes (com fake que verifica parâmetros), URL de download só para fotos confirmadas, guarda de produção em `Settings` (sem bucket com `storage_backend=s3` → erro), migração 0005. `boto3` entra em `requirements.txt`; `moto` ou fake próprio para testar `S3FileStorage` (preferir fake do cliente boto3 injetado, sem rede).

## B5: Ordens de serviço

**Tabelas:** `service_orders` (`id`, `number` sequencial legível `OS-000123` único, `vehicle_id`, `checkin_id` opcional, `mechanic_id` opcional (user com perfil mecânico), `reported_issue`, `diagnosis`, `labor_cost` (Decimal 10,2), `total` (Decimal 10,2, calculado), `due_date` opcional, `status`, timestamps, `deleted_at`, `created_by_id`, `updated_by_id`), `service_order_items` (`id`, `service_order_id`, `kind` `service|part`, `description`, `qty` Decimal(10,3) > 0, `unit_price` Decimal(10,2) >= 0, `rule_code` opcional (liga o serviço a uma regra do motor preventivo na próxima fase), `created_at`), `service_order_status_history` (`id`, `service_order_id`, `from_status`, `to_status`, `changed_by_id`, `changed_at`).

**Status e máquina de estados (domínio puro, testada exaustivamente):** `aberta → aguardando_orcamento → aguardando_aprovacao → em_execucao → finalizada → entregue`, mais o retorno `aguardando_aprovacao → aguardando_orcamento` (orçamento recusado/ajustado). Qualquer outra transição → 422 com a lista das permitidas. `entregue` e `finalizada` não aceitam edição de itens. Cada mudança grava histórico.

**Regras:** `total = labor_cost + Σ(qty × unit_price)` recalculado no service a cada mudança de itens/mão de obra (nunca confiar no cliente), com `Decimal` e arredondamento `ROUND_HALF_UP` a 2 casas. Só admin+recepção criam OS, definem mecânico, orçamento e aprovam; **mecânico** vê apenas as OS atribuídas a ele, pode editar `diagnosis` e itens e mover `em_execucao → finalizada` (e `aguardando_aprovacao`/`em_execucao` conforme a máquina, definir a tabela de permissões por transição e testá-la). Veículo inexistente → 404. Ao criar a partir de check-in, `vehicle_id` deve coincidir.

**Endpoints:** `GET /service-orders` (`page,size,q`, filtros `status`, `vehicle_id`, `mechanic_id`), `POST`, `GET /{id}` (com itens, histórico, veículo e cliente resumidos), `PATCH /{id}`, `POST /{id}/status {to}`, `POST /{id}/items`, `PATCH /{id}/items/{item_id}`, `DELETE /{id}/items/{item_id}`, `DELETE /{id}` (soft, só admin e só em `aberta`).

**Testes:** matriz completa de transições válidas/ inválidas, permissões por perfil e por transição, cálculo do total (casos com arredondamento), itens bloqueados após finalizar, mecânico só vê as próprias OS, histórico gravado, numeração sequencial sem colisão, filtros, migração 0006.

---

## Fecho

Ao final de B5: suíte completa verde, `ruff` limpo, README atualizado, CI (já existente) verde após o push (feito pelo controlador), e revisão final do conjunto (segurança, RBAC, transações, N+1, compatibilidade MySQL: `Decimal`, índices únicos com soft delete, collation).

**Fora deste plano (próximo plano):** motor de manutenção preventiva, índice de saúde, histórico do veículo e endpoints do dashboard/alertas, que passam a alimentar os cards hoje com dados de exemplo no frontend.

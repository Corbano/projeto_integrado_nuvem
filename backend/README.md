# Auto Center — Backend

API FastAPI do sistema de gestão para Auto Center (Projeto Integrado UNIFEOB).

## Rodando localmente

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
alembic upgrade head
python -m app.cli create-admin --name "Admin" --email admin@oficina.com
uvicorn app.main:app --reload
```

Swagger: http://127.0.0.1:8000/docs

## Criar o administrador

O comando `create-admin` aceita a senha de três formas (nesta ordem de precedência):

1. `--password` — desencorajado: a senha fica no histórico do shell.
2. Variável de ambiente `ADMIN_PASSWORD`:
   ```powershell
   $env:ADMIN_PASSWORD = "<sua-senha>"
   python -m app.cli create-admin --name "Admin" --email admin@oficina.com
   Remove-Item Env:ADMIN_PASSWORD
   ```
3. Prompt interativo `Senha: ` (usado quando nenhuma das anteriores é informada; a digitação não é exibida).

## Dados de demonstração

Popula o banco de **desenvolvimento** com dados fictícios (18 clientes, 28 veículos e leituras de quilometragem), usando os serviços reais e um administrador existente (rode `create-admin` antes):

```powershell
python -m app.cli seed-demo                      # usa o primeiro administrador ativo
python -m app.cli seed-demo --actor-email admin@oficina.com
python -m app.cli seed-demo --count-only         # simula, sem gravar
```

É idempotente (pula CPF/CNPJ e placas já cadastrados) e recusa rodar com `ENVIRONMENT=production`. Nunca apaga dados.

## Testes e lint

```powershell
python -m pytest
ruff check .
```

## Arquitetura

`domain` (entidades, regras, interfaces) → `application` (services, DTOs) →
`infrastructure` (SQLAlchemy, bcrypt, JWT) / `presentation` (routers FastAPI, DI, erros).

## Endpoints (`/api/v1`)

| Recurso | Rotas | Permissões |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | público / autenticado |
| Usuários | `GET,POST /users`, `GET,PATCH,DELETE /users/{id}` | admin |
| Clientes | `GET /customers` (`page`, `size`, `q` por nome/documento/telefone/e-mail), `POST /customers`, `GET,PATCH,DELETE /customers/{id}` | leitura: qualquer perfil autenticado; escrita: admin e recepção |
| Veículos | `GET /vehicles` (`page`, `size`, `q` por placa/marca/modelo, `customer_id`), `POST /vehicles`, `GET,PATCH,DELETE /vehicles/{id}`, `GET /customers/{id}/vehicles` | leitura: qualquer perfil autenticado; escrita: admin e recepção |
| Quilometragem | `POST /vehicles/{id}/km` (`km`, `note?`, `force?`), `GET /vehicles/{id}/km` (`page`, `size`, mais recentes primeiro) | leitura: qualquer perfil autenticado; registro: admin, recepção e mecânico (`force`: só admin) |
| Check-in | `GET /checkins` (`page`, `size`, `vehicle_id`), `POST /checkins`, `GET /checkins/{id}` (checklist + fotos), `POST /checkins/{id}/photos/presign`, `POST /checkins/{id}/photos/{photo_id}/confirm`, `DELETE /checkins/{id}/photos/{photo_id}` | leitura: qualquer perfil autenticado; escrita (incl. fotos): admin e recepção |

Clientes: `document` aceita CPF ou CNPJ (com ou sem máscara, validado pelos dígitos
verificadores) e é armazenado só com dígitos; único entre não excluídos (409). `phone`
tem 10–11 dígitos; `email` é salvo em minúsculas. A exclusão é lógica (204) e é bloqueada
(422) quando o cliente tem veículos.

Veículos: `plate` aceita `AAA9999` ou Mercosul `AAA9A99` (também minúscula e `ABC-1234`) e é
salva normalizada (`ABC1234`); `chassis` (opcional) é um VIN de 17 caracteres sem I/O/Q; `renavam`
(opcional) tem 9–11 dígitos; `year` vai de 1950 ao ano atual + 1; `fuel` é um de `gasolina`,
`etanol`, `flex`, `diesel`, `gnv`, `eletrico`, `hibrido`. Placa e chassi são únicos entre não
excluídos (409, garantido pelo banco via `active_plate`/`active_chassis`) e podem ser reutilizados
após a exclusão lógica. O cliente deve existir e estar ativo (404). `current_km` começa em 0, é
somente leitura e é rejeitado (422) em POST/PATCH. `customer_id` pode ser alterado no PATCH
(transferência). `GET /vehicles/{id}` inclui o resumo do cliente (`id`, `name`).

Quilometragem: `POST /vehicles/{id}/km` grava a leitura e atualiza `vehicles.current_km` na mesma transação. Valor menor que o atual é rejeitado (422 "A quilometragem não pode diminuir"); igual é idempotente (devolve a última leitura, sem criar outra); limite de 0 a 5.000.000. `force=true` (somente admin, 403 para os demais) permite diminuir e exige `note`. `KmService.register` (confirma) e `KmService.record` (não confirma, para compor a transação de check-in/OS) são reutilizáveis.

Check-in: `POST /checkins` exige os 7 itens do checklist (`pneus`, `suspensao`, `freios`, `iluminacao`, `bateria`, `ar_condicionado`, `limpadores`), cada um exatamente uma vez com `condition` `ok|atencao|critico` (faltando/repetido: 422), e `fuel_level` `vazio|quarto|meio|tres_quartos|cheio`. A quilometragem é registrada via `KmService.record` (origem `checkin`) **na mesma transação**: km menor que o atual dá 422 e nada é criado; igual é aceito sem nova leitura. Mecânico não cria check-in (403).

Fotos (máx. 10 por check-in, `image/jpeg|png|webp`, até 8 MB): `presign` valida tipo/tamanho/limite (confirmadas + reservas pendentes de até 15 min) e devolve `{photo_id, upload: {url, method, fields, headers}, expires_in}`; o cliente envia o arquivo direto ao S3 e chama `confirm`, que só confirma se o objeto existe no armazenamento com tipo/tamanho válidos (senão 422; objeto fora do combinado é descartado). `GET /checkins/{id}` devolve as fotos com `download_url` assinada de 15 minutos apenas para as confirmadas. A chave do objeto é `checkins/{checkin_id}/{uuid4}.{ext}`, com a extensão vinda do tipo validado, nunca do nome do arquivo.

## Armazenamento de fotos

`STORAGE_BACKEND=local` (padrão, dev/testes) grava em `backend/.storage/` (ignorado pelo git) e não expõe nenhum endpoint de upload: o presign devolve uma URL fictícia `local://...` e os arquivos entram via `LocalFileStorage.put` (usado nos testes). `STORAGE_BACKEND=s3` usa o bucket `S3_BUCKET` na região `S3_REGION`; as credenciais vêm **somente** da cadeia padrão do boto3 (role da instância EC2), nunca de variáveis do app. Com `ENVIRONMENT=production` a aplicação não inicia sem `STORAGE_BACKEND=s3` e `S3_BUCKET`.

O upload usa **POST pré-assinado** (não PUT): a política assinada impõe no próprio S3 o `Content-Type` e `content-length-range` (1 byte a 8 MB), o que um PUT pré-assinado não consegue garantir. O cliente envia um `multipart/form-data` com todos os `fields` devolvidos e, por último, o campo `file`.

Recomendações para o bucket:

- Bucket **privado**, com *Block Public Access* ativo nas 4 opções e criptografia padrão (SSE-S3 ou KMS); leitura só por URL assinada.
- **CORS** liberando apenas a origem do frontend (ex.: `https://app.exemplo.com`), métodos `POST` e `PUT`, cabeçalhos `*` e `ExposeHeaders: ETag`.
- Permissões da role IAM da instância EC2: `s3:PutObject`, `s3:GetObject` e `s3:DeleteObject` em `arn:aws:s3:::SEU-BUCKET/checkins/*` **e** `s3:ListBucket` em `arn:aws:s3:::SEU-BUCKET` (sem ela, chave inexistente devolve 403 em vez de 404 e o `confirm` falha com 503; nada de `s3:*`).
- Configure uma regra de ciclo de vida em `checkins/` (expirar objetos e abortar multipart incompletos) para limpar objetos órfãos; as linhas de fotos pendentes nunca confirmadas ficam ocultas e deixam de contar no limite após 15 minutos.

Falhas do S3 (credenciais ausentes, timeout, erro de rede ou `ClientError`) viram **503** `storage_unavailable` ("Armazenamento de arquivos indisponível. Tente novamente em instantes."), sem expor bucket/chave; a causa é logada sem URL assinada. O cliente boto3 usa `connect_timeout=3s`, `read_timeout=5s` e 2 tentativas. Presign e confirm travam a linha do check-in (`SELECT ... FOR UPDATE`) antes de contar fotos, serializando o limite de 10; o bloqueio real só existe no MySQL (SQLite o ignora).

## Variáveis de ambiente

Ver `.env.example`. Em produção (`ENVIRONMENT=production`) o `JWT_SECRET` precisa ter
pelo menos 32 caracteres, senão a aplicação não inicia. Para MySQL/RDS use
`DATABASE_URL=mysql+pymysql://usuario:senha@endpoint:3306/autocenter`.

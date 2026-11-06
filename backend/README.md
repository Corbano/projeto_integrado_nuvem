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

## Variáveis de ambiente

Ver `.env.example`. Em produção (`ENVIRONMENT=production`) o `JWT_SECRET` precisa ter
pelo menos 32 caracteres, senão a aplicação não inicia. Para MySQL/RDS use
`DATABASE_URL=mysql+pymysql://usuario:senha@endpoint:3306/autocenter`.

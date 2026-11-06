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

## Variáveis de ambiente

Ver `.env.example`. Em produção (`ENVIRONMENT=production`) o `JWT_SECRET` precisa ter
pelo menos 32 caracteres, senão a aplicação não inicia. Para MySQL/RDS use
`DATABASE_URL=mysql+pymysql://usuario:senha@endpoint:3306/autocenter`.

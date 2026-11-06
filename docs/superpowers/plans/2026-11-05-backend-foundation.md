# Backend Foundation Implementation Plan (Plano 1 de 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a base do backend FastAPI (config, banco, migrations, autenticação JWT, RBAC, CRUD de usuários, tratamento global de erros, CI) funcionando e testada localmente.

**Architecture:** Clean Architecture em 4 camadas (`domain` → `application` → `infrastructure` / `presentation`). O domínio define entidades e interfaces (Protocols); a infraestrutura implementa (SQLAlchemy, bcrypt, JWT); a apresentação (routers FastAPI) monta tudo por injeção de dependência (`Depends`). Erros de negócio são exceções de domínio convertidas em JSON por handlers globais.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2 / pydantic-settings, PyJWT, bcrypt, pytest, ruff. Banco: SQLite em dev/testes, MySQL (RDS) em produção via `DATABASE_URL`.

**Planos seguintes (fora deste documento):** Plano 2 — clientes, veículos, check-in/S3, OS. Plano 3 — motor preventivo, índice de saúde, histórico, dashboard. Plano 4 — frontend React e deploy AWS/CD.

**Convenções:**
- Todos os comandos rodam em `C:\Users\Dell\projeto_integrado_nuvem\backend` com o venv ativado, salvo indicação.
- Mensagens de commit terminam com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (por isso cada `git commit` usa dois `-m`).
- Mensagens de erro ao usuário em português.

---

## File Structure

```
projeto_integrado_nuvem/
  .gitignore
  .github/workflows/ci.yml
  backend/
    pyproject.toml            # ruff + pytest
    requirements.txt          # runtime
    requirements-dev.txt      # + pytest, httpx, ruff
    .env.example
    alembic.ini
    README.md
    migrations/               # Alembic (nome evita conflito com o pacote alembic)
      env.py  script.py.mako  versions/0001_create_users.py
    app/
      main.py                         # create_app(), CORS, routers, handlers
      cli.py                          # create-admin
      domain/
        roles.py                      # enum Role
        errors.py                     # AppError e subclasses
        user.py                       # entidade User + Protocol UserRepository
      application/
        ports.py                      # Protocols PasswordHasher, TokenCodec
        dtos/common.py                # Page[T]
        dtos/auth.py                  # LoginRequest, TokenResponse
        dtos/user.py                  # UserCreate, UserUpdate, UserOut
        services/auth_service.py
        services/user_service.py
      infrastructure/
        config.py                     # Settings
        security.py                   # BcryptHasher, JwtCodec
        db/base.py                    # Base, TimestampMixin, SoftDeleteMixin
        db/session.py                 # engine, SessionLocal, get_db
        db/models/__init__.py  db/models/user.py
        repositories/user_repository.py
      presentation/
        errors.py                     # handlers globais
        deps.py                       # DI + get_current_user + require_roles
        routers/auth.py  routers/users.py
    tests/
      conftest.py
      test_health.py  test_config.py  test_db_models.py  test_security.py
      test_error_handlers.py  test_user_repository.py  test_auth_api.py
      test_users_api.py  test_migrations.py  test_cli.py
```

---

### Task 1: Scaffold, git e endpoint /health

**Files:**
- Create: `.gitignore`, `backend/pyproject.toml`, `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/.env.example`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_health.py`

- [ ] **Step 1: Inicializar git e criar o venv**

```powershell
cd C:\Users\Dell\projeto_integrado_nuvem
git init -b main
cd backend
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
Expected: `Python 3.11.x` ou superior. Se for menor, instalar Python 3.12 antes de seguir.

- [ ] **Step 2: Criar `.gitignore` (na raiz do repositório)**

```gitignore
.venv/
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
.env
*.db
node_modules/
dist/
.idea/
.vscode/
```

- [ ] **Step 3: Criar `backend/pyproject.toml`**

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]
```

- [ ] **Step 4: Criar `backend/requirements.txt`**

```text
fastapi>=0.115
uvicorn[standard]>=0.30
sqlalchemy>=2.0
alembic>=1.13
pydantic>=2.7
pydantic-settings>=2.3
email-validator>=2.1
pymysql>=1.1
cryptography>=42
pyjwt>=2.9
bcrypt>=4.1
```

- [ ] **Step 5: Criar `backend/requirements-dev.txt`**

```text
-r requirements.txt
pytest>=8.0
httpx>=0.27
ruff>=0.6
```

- [ ] **Step 6: Criar `backend/.env.example`**

```dotenv
ENVIRONMENT=development
DATABASE_URL=sqlite:///./autocenter.db
# Produção (RDS): mysql+pymysql://usuario:senha@endpoint-rds:3306/autocenter
JWT_SECRET=troque-por-um-segredo-de-pelo-menos-32-caracteres
ACCESS_TOKEN_MINUTES=60
CORS_ORIGINS=["http://localhost:5173"]
```

- [ ] **Step 7: Instalar dependências**

```powershell
pip install -r requirements-dev.txt
```
Expected: instalação sem erros.

- [ ] **Step 8: Criar arquivos vazios de pacote e o conftest mínimo**

`backend/app/__init__.py` e `backend/tests/__init__.py`: vazios.

`backend/tests/conftest.py`:
```python
import os

# Deve rodar antes de qualquer import de `app` (as Settings são cacheadas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"
```

- [ ] **Step 9: Escrever o teste que falha — `backend/tests/test_health.py`**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `python -m pytest tests/test_health.py -v`
Expected: FAIL com `ModuleNotFoundError` / `ImportError` de `app.main`.

- [ ] **Step 11: Implementação mínima — `backend/app/main.py`**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Auto Center API", version="0.1.0")

    @app.get("/health", tags=["infra"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 12: Rodar e ver passar**

Run: `python -m pytest tests/test_health.py -v`
Expected: PASS (1 passed).

- [ ] **Step 13: Commit**

```powershell
cd ..
git add .gitignore backend
git commit -m "chore: scaffold do backend com endpoint /health" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
cd backend
```

---

### Task 2: Configuração (Settings)

**Files:**
- Create: `backend/app/infrastructure/__init__.py`, `backend/app/infrastructure/config.py`, `backend/tests/test_config.py`

- [ ] **Step 1: Criar `backend/app/infrastructure/__init__.py` (vazio) e escrever o teste — `backend/tests/test_config.py`**

```python
import pytest
from pydantic import ValidationError

from app.infrastructure.config import Settings


def test_defaults_are_development():
    settings = Settings(_env_file=None)

    assert settings.environment == "development"
    assert settings.access_token_minutes == 60
    assert settings.jwt_algorithm == "HS256"


def test_production_rejects_default_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production", jwt_secret="change-me")


def test_production_rejects_short_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production", jwt_secret="curto")


def test_production_accepts_strong_secret():
    settings = Settings(_env_file=None, environment="production", jwt_secret="x" * 40)

    assert settings.environment == "production"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_config.py -v`
Expected: FAIL com `ModuleNotFoundError: app.infrastructure.config`.

- [ ] **Step 3: Implementar — `backend/app/infrastructure/config.py`**

```python
from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Auto Center API"
    environment: str = "development"
    database_url: str = "sqlite:///./autocenter.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=60, ge=1)
    bcrypt_rounds: int = Field(default=12, ge=4, le=15)
    cors_origins: list[str] = ["http://localhost:5173"]

    @model_validator(mode="after")
    def _validate_production_secret(self) -> "Settings":
        if self.environment == "production" and (
            self.jwt_secret == "change-me" or len(self.jwt_secret) < 32
        ):
            raise ValueError("JWT_SECRET forte (>= 32 caracteres) é obrigatório em produção")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_config.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```powershell
git add app/infrastructure tests/test_config.py
git commit -m "feat: configuracao via variaveis de ambiente com guarda de producao" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Camada de banco (Base, mixins, sessão) e modelo User

**Files:**
- Create: `backend/app/infrastructure/db/__init__.py`, `backend/app/infrastructure/db/base.py`, `backend/app/infrastructure/db/session.py`, `backend/app/infrastructure/db/models/__init__.py`, `backend/app/infrastructure/db/models/user.py`, `backend/tests/test_db_models.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Substituir `backend/tests/conftest.py` (adiciona fixtures de banco)**

```python
import os

# Deve rodar antes de qualquer import de `app` (as Settings são cacheadas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.infrastructure.db.models  # noqa: E402, F401  (registra tabelas no metadata)
from app.infrastructure.db.base import Base  # noqa: E402


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine):
    with Session(engine, expire_on_commit=False) as session:
        yield session
```

- [ ] **Step 2: Escrever o teste que falha — `backend/tests/test_db_models.py`**

```python
import pytest
from sqlalchemy.exc import IntegrityError

from app.infrastructure.db.models.user import UserModel


def test_user_model_has_defaults(db_session):
    user = UserModel(name="Ana", email="ana@example.com", password_hash="h", role="admin")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.active is True
    assert user.deleted_at is None
    assert user.created_at is not None
    assert user.updated_at is not None


def test_user_email_is_unique(db_session):
    db_session.add(UserModel(name="A", email="dup@example.com", password_hash="h", role="admin"))
    db_session.commit()
    db_session.add(UserModel(name="B", email="dup@example.com", password_hash="h", role="admin"))

    with pytest.raises(IntegrityError):
        db_session.commit()
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `python -m pytest tests/test_db_models.py -v`
Expected: FAIL/erro de coleta: `ModuleNotFoundError: app.infrastructure.db`.

- [ ] **Step 4: Criar `backend/app/infrastructure/db/__init__.py` (vazio) e `backend/app/infrastructure/db/base.py`**

```python
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarativa de todos os modelos."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    """Exclusão lógica: registros nunca são apagados, apenas marcados."""

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 5: Criar `backend/app/infrastructure/db/session.py`**

```python
from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.infrastructure.config import get_settings


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, pool_pre_ping=True, pool_recycle=1800)


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 6: Criar `backend/app/infrastructure/db/models/user.py`**

```python
from sqlalchemy import String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base, SoftDeleteMixin, TimestampMixin


class UserModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default=true())
```

- [ ] **Step 7: Criar `backend/app/infrastructure/db/models/__init__.py`**

```python
from app.infrastructure.db.models.user import UserModel

__all__ = ["UserModel"]
```

- [ ] **Step 8: Rodar e ver passar**

Run: `python -m pytest tests/test_db_models.py -v`
Expected: PASS (2 passed).

- [ ] **Step 9: Commit**

```powershell
git add app/infrastructure/db tests
git commit -m "feat: camada de banco, mixins de timestamp/soft delete e modelo User" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Domínio (Role, erros, entidade User, portas) e segurança (bcrypt + JWT)

**Files:**
- Create: `backend/app/domain/__init__.py`, `backend/app/domain/roles.py`, `backend/app/domain/errors.py`, `backend/app/domain/user.py`, `backend/app/application/__init__.py`, `backend/app/application/ports.py`, `backend/app/infrastructure/security.py`, `backend/tests/test_security.py`

- [ ] **Step 1: Criar `__init__.py` vazios e `backend/app/domain/roles.py`**

```python
from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    RECEPTION = "reception"
    MECHANIC = "mechanic"
```

- [ ] **Step 2: Criar `backend/app/domain/errors.py`**

```python
class AppError(Exception):
    """Erro de negócio. A camada de apresentação converte em resposta HTTP."""

    code = "app_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    code = "not_found"


class ConflictError(AppError):
    code = "conflict"


class AuthenticationError(AppError):
    code = "authentication_failed"


class PermissionDeniedError(AppError):
    code = "permission_denied"


class BusinessRuleError(AppError):
    code = "business_rule_violation"
```

- [ ] **Step 3: Criar `backend/app/domain/user.py`**

```python
from dataclasses import dataclass
from typing import Protocol

from app.domain.roles import Role


@dataclass
class User:
    id: int | None
    name: str
    email: str
    password_hash: str
    role: Role
    active: bool = True


class UserRepository(Protocol):
    def get_by_id(self, user_id: int) -> User | None: ...

    def get_by_email(self, email: str) -> User | None: ...

    def email_exists(self, email: str) -> bool:
        """Verdadeiro mesmo para usuários excluídos (o e-mail continua reservado)."""
        ...

    def add(self, user: User) -> User: ...

    def update(self, user: User) -> User: ...

    def soft_delete(self, user_id: int) -> None: ...

    def list_page(
        self, *, offset: int, limit: int, search: str | None
    ) -> tuple[list[User], int]: ...
```

- [ ] **Step 4: Criar `backend/app/application/ports.py`**

```python
from typing import Protocol

from app.domain.roles import Role


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password: str, password_hash: str) -> bool: ...


class TokenCodec(Protocol):
    def encode(self, user_id: int, role: Role) -> str: ...
```

- [ ] **Step 5: Escrever o teste que falha — `backend/tests/test_security.py`**

```python
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.domain.errors import AuthenticationError, BusinessRuleError
from app.domain.roles import Role
from app.infrastructure.security import BcryptHasher, JwtCodec

SECRET = "s" * 40


def test_hash_and_verify_roundtrip():
    hasher = BcryptHasher(rounds=4)

    hashed = hasher.hash("senha-segura-1")

    assert hashed != "senha-segura-1"
    assert hasher.verify("senha-segura-1", hashed) is True
    assert hasher.verify("outra-senha", hashed) is False


def test_verify_returns_false_for_malformed_hash():
    assert BcryptHasher(rounds=4).verify("x", "isso-nao-e-bcrypt") is False


def test_hash_rejects_password_over_72_bytes():
    with pytest.raises(BusinessRuleError):
        BcryptHasher(rounds=4).hash("a" * 73)


def test_token_roundtrip():
    codec = JwtCodec(SECRET)

    payload = codec.decode(codec.encode(7, Role.MECHANIC))

    assert payload.user_id == 7
    assert payload.role is Role.MECHANIC


def test_expired_token_is_rejected():
    codec = JwtCodec(SECRET, expires_minutes=-1)

    with pytest.raises(AuthenticationError):
        codec.decode(codec.encode(1, Role.ADMIN))


def test_token_signed_with_other_secret_is_rejected():
    token = JwtCodec("a" * 40).encode(1, Role.ADMIN)

    with pytest.raises(AuthenticationError):
        JwtCodec("b" * 40).decode(token)


def test_token_without_exp_is_rejected():
    token = jwt.encode({"sub": "1", "role": "admin"}, SECRET, algorithm="HS256")

    with pytest.raises(AuthenticationError):
        JwtCodec(SECRET).decode(token)


def test_token_without_sub_is_rejected():
    exp = datetime.now(UTC) + timedelta(minutes=5)
    token = jwt.encode({"role": "admin", "exp": exp}, SECRET, algorithm="HS256")

    with pytest.raises(AuthenticationError):
        JwtCodec(SECRET).decode(token)


def test_garbage_token_is_rejected():
    with pytest.raises(AuthenticationError):
        JwtCodec(SECRET).decode("nao.e.um-jwt")
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `python -m pytest tests/test_security.py -v`
Expected: FAIL com `ModuleNotFoundError: app.infrastructure.security`.

- [ ] **Step 7: Implementar — `backend/app/infrastructure/security.py`**

```python
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.domain.errors import AuthenticationError, BusinessRuleError
from app.domain.roles import Role


class BcryptHasher:
    def __init__(self, rounds: int = 12) -> None:
        self._rounds = rounds

    def hash(self, password: str) -> str:
        raw = password.encode("utf-8")
        if len(raw) > 72:
            raise BusinessRuleError("A senha deve ter no máximo 72 bytes")
        return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=self._rounds)).decode("utf-8")

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False


@dataclass(frozen=True)
class TokenPayload:
    user_id: int
    role: Role


class JwtCodec:
    def __init__(
        self, secret: str, algorithm: str = "HS256", expires_minutes: int = 60
    ) -> None:
        self._secret = secret
        self._algorithm = algorithm
        self._expires_minutes = expires_minutes

    def encode(self, user_id: int, role: Role) -> str:
        now = datetime.now(UTC)
        claims = {
            "sub": str(user_id),
            "role": role.value,
            "iat": now,
            "exp": now + timedelta(minutes=self._expires_minutes),
        }
        return jwt.encode(claims, self._secret, algorithm=self._algorithm)

    def decode(self, token: str) -> TokenPayload:
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=[self._algorithm],
                options={"require": ["exp", "sub"]},
            )
            return TokenPayload(user_id=int(claims["sub"]), role=Role(claims["role"]))
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise AuthenticationError("Token inválido ou expirado") from exc
```

- [ ] **Step 8: Rodar e ver passar**

Run: `python -m pytest tests/test_security.py -v`
Expected: PASS (9 passed).

- [ ] **Step 9: Commit**

```powershell
git add app tests/test_security.py
git commit -m "feat: dominio (roles, erros, User), portas e seguranca bcrypt/JWT" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tratamento global de exceções

**Files:**
- Create: `backend/app/presentation/__init__.py`, `backend/app/presentation/errors.py`, `backend/tests/test_error_handlers.py`

- [ ] **Step 1: Escrever o teste que falha — `backend/tests/test_error_handlers.py`**

```python
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.domain.errors import (
    AuthenticationError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.presentation.errors import register_exception_handlers


class Body(BaseModel):
    qty: int


class Credentials(BaseModel):
    password: str = Field(min_length=8)


class SpecificNotFound(NotFoundError):
    pass


@pytest.fixture
def client():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/raise/{kind}")
    def raise_error(kind: str):
        errors = {
            "not_found": NotFoundError("Não achei"),
            "conflict": ConflictError("Já existe"),
            "auth": AuthenticationError("Sem credenciais"),
            "forbidden": PermissionDeniedError("Proibido"),
            "rule": BusinessRuleError("Regra violada"),
        }
        raise errors[kind]

    @app.post("/validate")
    def validate(body: Body):
        return body

    @app.post("/credentials")
    def credentials(body: Credentials):
        return {"ok": True}

    @app.get("/subclass")
    def subclass():
        raise SpecificNotFound("Específico")

    @app.get("/http-401")
    def http_401():
        raise HTTPException(401, "x", headers={"WWW-Authenticate": "Bearer"})

    return TestClient(app)


@pytest.mark.parametrize(
    ("kind", "status", "code"),
    [
        ("not_found", 404, "not_found"),
        ("conflict", 409, "conflict"),
        ("auth", 401, "authentication_failed"),
        ("forbidden", 403, "permission_denied"),
        ("rule", 422, "business_rule_violation"),
    ],
)
def test_domain_errors_map_to_http(client, kind, status, code):
    response = client.get(f"/raise/{kind}")

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"]


def test_auth_error_sets_www_authenticate(client):
    response = client.get("/raise/auth")

    assert response.headers["www-authenticate"] == "Bearer"


def test_request_validation_error_uses_standard_envelope(client):
    response = client.post("/validate", json={"qty": "abc"})

    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert body["details"]


def test_validation_error_does_not_echo_submitted_values(client):
    response = client.post("/credentials", json={"password": "hunter2"})

    assert response.status_code == 422
    details = response.json()["error"]["details"]
    assert details
    assert all(set(item) <= {"loc", "msg", "type"} for item in details)
    assert "hunter2" not in response.text


def test_unknown_route_uses_envelope(client):
    response = client.get("/nao-existe")

    assert response.status_code == 404
    body = response.json()
    assert "detail" not in body
    assert body["error"]["code"] == "not_found"


def test_method_not_allowed_uses_envelope(client):
    response = client.post("/raise/auth")

    assert response.status_code == 405
    body = response.json()
    assert "detail" not in body
    assert body["error"]["code"] == "method_not_allowed"


def test_http_exception_keeps_headers(client):
    response = client.get("/http-401")

    assert response.status_code == 401
    assert response.json()["error"] == {"code": "authentication_failed", "message": "x"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_domain_error_subclass_maps_via_mro(client):
    response = client.get("/subclass")

    assert response.status_code == 404
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_error_handlers.py -v`
Expected: FAIL com `ModuleNotFoundError: app.presentation`.

- [ ] **Step 3: Criar `backend/app/presentation/__init__.py` (vazio) e `backend/app/presentation/errors.py`**

```python
import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domain.errors import (
    AppError,
    AuthenticationError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

logger = logging.getLogger("autocenter.errors")

_STATUS_BY_ERROR: dict[type[AppError], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    AuthenticationError: 401,
    PermissionDeniedError: 403,
    BusinessRuleError: 422,
}


_CODE_BY_HTTP_STATUS: dict[int, str] = {
    400: "bad_request",
    401: "authentication_failed",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
}


def _envelope(code: str, message: str, **extra: object) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        status = next((s for t in type(exc).__mro__ if (s := _STATUS_BY_ERROR.get(t))), 400)
        headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
        return JSONResponse(
            status_code=status, content=_envelope(exc.code, exc.message), headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Nunca refletir `input`, `ctx` ou `url`: podem conter valores sensíveis enviados.
        details = [
            {k: v for k, v in e.items() if k in ("loc", "msg", "type")}
            for e in jsonable_encoder(exc.errors())
        ]
        return JSONResponse(
            status_code=422,
            content=_envelope("validation_error", "Dados inválidos", details=details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _CODE_BY_HTTP_STATUS.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "Erro na requisição"
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(code, message),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500, content=_envelope("internal_error", "Erro interno do servidor")
        )
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_error_handlers.py -v`
Expected: PASS (12 passed).

- [ ] **Step 5: Commit**

```powershell
git add app/presentation tests/test_error_handlers.py
git commit -m "feat: handlers globais de excecao com envelope de erro padronizado" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Repositório de usuários (SQLAlchemy)

**Files:**
- Create: `backend/app/infrastructure/repositories/__init__.py`, `backend/app/infrastructure/repositories/user_repository.py`, `backend/tests/test_user_repository.py`

- [ ] **Step 1: Escrever o teste que falha — `backend/tests/test_user_repository.py`**

```python
import pytest

from app.domain.errors import ConflictError, NotFoundError
from app.domain.roles import Role
from app.domain.user import User
from app.infrastructure.repositories.user_repository import SqlUserRepository


@pytest.fixture
def repo(db_session):
    return SqlUserRepository(db_session)


def new_user(email="ana@example.com", name="Ana", role=Role.ADMIN) -> User:
    return User(id=None, name=name, email=email, password_hash="hash", role=role)


def test_add_assigns_id_and_roundtrips(repo):
    saved = repo.add(new_user())

    assert saved.id is not None
    assert repo.get_by_id(saved.id) == saved
    assert repo.get_by_email("ana@example.com") == saved


def test_get_missing_returns_none(repo):
    assert repo.get_by_id(999) is None
    assert repo.get_by_email("nao@existe.com") is None


def test_update_persists_changes(repo):
    saved = repo.add(new_user())
    saved.name = "Ana Maria"
    saved.role = Role.RECEPTION
    saved.active = False

    updated = repo.update(saved)

    assert updated.name == "Ana Maria"
    assert repo.get_by_id(saved.id).role is Role.RECEPTION
    assert repo.get_by_id(saved.id).active is False


def test_soft_delete_hides_user_but_reserves_email(repo):
    saved = repo.add(new_user())

    repo.soft_delete(saved.id)

    assert repo.get_by_id(saved.id) is None
    assert repo.get_by_email("ana@example.com") is None
    assert repo.email_exists("ana@example.com") is True


def test_soft_delete_missing_raises(repo):
    with pytest.raises(NotFoundError):
        repo.soft_delete(999)


def test_list_page_paginates_and_counts(repo):
    for i in range(5):
        repo.add(new_user(email=f"u{i}@example.com", name=f"User {i}"))

    items, total = repo.list_page(offset=2, limit=2, search=None)

    assert total == 5
    assert [u.email for u in items] == ["u2@example.com", "u3@example.com"]


def test_list_page_search_matches_name_or_email(repo):
    repo.add(new_user(email="joao@oficina.com", name="João"))
    repo.add(new_user(email="maria@oficina.com", name="Maria"))

    by_name, total_name = repo.list_page(offset=0, limit=10, search="joão")
    by_email, total_email = repo.list_page(offset=0, limit=10, search="maria@")

    assert total_name == 1 and by_name[0].name == "João"
    assert total_email == 1 and by_email[0].name == "Maria"


def test_add_duplicate_email_raises_conflict(repo):
    repo.add(new_user())

    with pytest.raises(ConflictError):
        repo.add(new_user(name="Outra Ana"))


def test_session_usable_after_duplicate_email(repo):
    first = repo.add(new_user())

    with pytest.raises(ConflictError):
        repo.add(new_user(name="Outra Ana"))

    assert repo.get_by_email("ana@example.com") == first
    other = repo.add(new_user(email="outra@example.com", name="Outra"))
    assert other.id is not None


def test_list_page_search_escapes_like_wildcards(repo):
    repo.add(new_user(email="a@example.com", name="Ana"))
    repo.add(new_user(email="b@example.com", name="Bia"))

    _, total_percent = repo.list_page(offset=0, limit=10, search="%")
    _, total_underscore = repo.list_page(offset=0, limit=10, search="_")
    found, total_a = repo.list_page(offset=0, limit=10, search="a@")

    assert total_percent == 0
    assert total_underscore == 0
    assert total_a == 1 and found[0].email == "a@example.com"


def test_list_page_excludes_deleted(repo):
    keep = repo.add(new_user(email="a@example.com"))
    gone = repo.add(new_user(email="b@example.com"))
    repo.soft_delete(gone.id)

    items, total = repo.list_page(offset=0, limit=10, search=None)

    assert total == 1 and items[0].id == keep.id
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_user_repository.py -v`
Expected: FAIL com `ModuleNotFoundError: app.infrastructure.repositories`.

- [ ] **Step 3: Criar `backend/app/infrastructure/repositories/__init__.py` (vazio) e `user_repository.py`**

```python
from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.errors import ConflictError, NotFoundError
from app.domain.roles import Role
from app.domain.user import User
from app.infrastructure.db.models.user import UserModel


class SqlUserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(model: UserModel) -> User:
        return User(
            id=model.id,
            name=model.name,
            email=model.email,
            password_hash=model.password_hash,
            role=Role(model.role),
            active=model.active,
        )

    @staticmethod
    def _alive() -> Select[tuple[UserModel]]:
        return select(UserModel).where(UserModel.deleted_at.is_(None))

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise ConflictError("E-mail já cadastrado") from None

    def _get_alive_model(self, user_id: int) -> UserModel:
        model = self._db.scalar(self._alive().where(UserModel.id == user_id))
        if model is None:
            raise NotFoundError("Usuário não encontrado")
        return model

    def get_by_id(self, user_id: int) -> User | None:
        model = self._db.scalar(self._alive().where(UserModel.id == user_id))
        return self._to_entity(model) if model else None

    def get_by_email(self, email: str) -> User | None:
        model = self._db.scalar(self._alive().where(UserModel.email == email))
        return self._to_entity(model) if model else None

    def email_exists(self, email: str) -> bool:
        count = self._db.scalar(
            select(func.count()).select_from(UserModel).where(UserModel.email == email)
        )
        return bool(count)

    def add(self, user: User) -> User:
        model = UserModel(
            name=user.name,
            email=user.email,
            password_hash=user.password_hash,
            role=user.role.value,
            active=user.active,
        )
        self._db.add(model)
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def update(self, user: User) -> User:
        model = self._get_alive_model(user.id)
        model.name = user.name
        model.password_hash = user.password_hash
        model.role = user.role.value
        model.active = user.active
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def soft_delete(self, user_id: int) -> None:
        model = self._get_alive_model(user_id)
        model.deleted_at = datetime.now(UTC).replace(tzinfo=None)
        self._db.commit()

    def list_page(
        self, *, offset: int, limit: int, search: str | None
    ) -> tuple[list[User], int]:
        stmt = self._alive()
        if search and search.strip():
            esc = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            like = f"%{esc}%"
            stmt = stmt.where(
                or_(
                    UserModel.name.ilike(like, escape="\\"),
                    UserModel.email.ilike(like, escape="\\"),
                )
            )
        total = self._db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self._db.scalars(stmt.order_by(UserModel.id).offset(offset).limit(limit)).all()
        return [self._to_entity(r) for r in rows], total
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_user_repository.py -v`
Expected: PASS (11 passed).

- [ ] **Step 5: Commit**

```powershell
git add app/infrastructure/repositories tests/test_user_repository.py
git commit -m "feat: repositorio SQL de usuarios com soft delete, busca e paginacao" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: DTOs, AuthService, dependências e endpoints de autenticação

**Files:**
- Create: `backend/app/application/dtos/__init__.py`, `backend/app/application/dtos/common.py`, `backend/app/application/dtos/auth.py`, `backend/app/application/dtos/user.py`, `backend/app/application/services/__init__.py`, `backend/app/application/services/auth_service.py`, `backend/app/presentation/deps.py`, `backend/app/presentation/routers/__init__.py`, `backend/app/presentation/routers/auth.py`, `backend/tests/test_auth_api.py`
- Modify: `backend/app/main.py`, `backend/tests/conftest.py`

- [ ] **Step 1: Criar `backend/app/application/dtos/__init__.py` (vazio) e `common.py`**

```python
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
```

- [ ] **Step 2: Criar `backend/app/application/dtos/auth.py`**

```python
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

- [ ] **Step 3: Criar `backend/app/application/dtos/user.py`**

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.roles import Role
from app.domain.user import User


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role: Role | None = None
    active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: Role
    active: bool

    @classmethod
    def from_entity(cls, user: User) -> "UserOut":
        return cls(
            id=user.id, name=user.name, email=user.email, role=user.role, active=user.active
        )
```

- [ ] **Step 4: Criar `backend/app/application/services/__init__.py` (vazio) e `auth_service.py`**

```python
from app.application.dtos.auth import TokenResponse
from app.application.ports import PasswordHasher, TokenCodec
from app.domain.errors import AuthenticationError
from app.domain.user import UserRepository

# Hash bcrypt (custo 12) de uma senha descartável; não é segredo. Gerado uma única vez.
_DUMMY_PASSWORD_HASH = "$2b$12$C1Suo5f5h1ztDpEm5I4lxeSySsgeKyklUnNqCf6brAfneGWBVW3KO"


class AuthService:
    def __init__(
        self, users: UserRepository, hasher: PasswordHasher, codec: TokenCodec
    ) -> None:
        self._users = users
        self._hasher = hasher
        self._codec = codec

    def login(self, email: str, password: str) -> TokenResponse:
        user = self._users.get_by_email(email.lower())
        # Sempre executa o verify (contra um hash falso se o usuário não existe) para que o
        # tempo de resposta não revele se o e-mail existe. Mesma mensagem para qualquer falha.
        password_ok = self._hasher.verify(
            password, user.password_hash if user else _DUMMY_PASSWORD_HASH
        )
        if user is None or not user.active or not password_ok:
            raise AuthenticationError("Credenciais inválidas")
        return TokenResponse(access_token=self._codec.encode(user.id, user.role))
```

- [ ] **Step 5: Criar `backend/app/presentation/deps.py`**

```python
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.application.services.auth_service import AuthService
from app.domain.errors import AuthenticationError, PermissionDeniedError
from app.domain.roles import Role
from app.domain.user import User
from app.infrastructure.config import get_settings
from app.infrastructure.db.session import get_db
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.security import BcryptHasher, JwtCodec

bearer_scheme = HTTPBearer(auto_error=False)


def get_codec() -> JwtCodec:
    settings = get_settings()
    return JwtCodec(settings.jwt_secret, settings.jwt_algorithm, settings.access_token_minutes)


def get_hasher() -> BcryptHasher:
    return BcryptHasher(rounds=get_settings().bcrypt_rounds)


def get_user_repository(db: Session = Depends(get_db)) -> SqlUserRepository:
    return SqlUserRepository(db)


def get_auth_service(
    users: SqlUserRepository = Depends(get_user_repository),
    hasher: BcryptHasher = Depends(get_hasher),
    codec: JwtCodec = Depends(get_codec),
) -> AuthService:
    return AuthService(users, hasher, codec)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    codec: JwtCodec = Depends(get_codec),
    users: SqlUserRepository = Depends(get_user_repository),
) -> User:
    if credentials is None:
        raise AuthenticationError("Autenticação necessária")
    payload = codec.decode(credentials.credentials)
    user = users.get_by_id(payload.user_id)
    if user is None or not user.active:
        raise AuthenticationError("Usuário inválido ou inativo")
    return user


def require_roles(*roles: Role):
    """Dependência que só deixa passar usuários com um dos perfis informados."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise PermissionDeniedError("Acesso negado para este perfil")
        return user

    return dependency
```

- [ ] **Step 6: Criar `backend/app/presentation/routers/__init__.py` (vazio) e `routers/auth.py`**

```python
from fastapi import APIRouter, Depends

from app.application.dtos.auth import LoginRequest, TokenResponse
from app.application.dtos.user import UserOut
from app.application.services.auth_service import AuthService
from app.domain.user import User
from app.presentation.deps import get_auth_service, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, service: AuthService = Depends(get_auth_service)):
    return service.login(body.email, body.password)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.from_entity(user)
```

- [ ] **Step 7: Substituir `backend/app/main.py`**

```python
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.config import get_settings
from app.presentation.errors import register_exception_handlers
from app.presentation.routers import auth


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    app = FastAPI(title=settings.app_name, version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.get("/health", tags=["infra"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router, prefix="/api/v1")
    return app


app = create_app()
```

- [ ] **Step 8: Substituir `backend/tests/conftest.py` (adiciona client, make_user, auth_header)**

```python
import itertools
import os

# Deve rodar antes de qualquer import de `app` (as Settings são cacheadas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.infrastructure.db.models  # noqa: E402, F401  (registra tabelas no metadata)
from app.domain.roles import Role  # noqa: E402
from app.domain.user import User  # noqa: E402
from app.infrastructure.db.base import Base  # noqa: E402
from app.infrastructure.db.session import get_db  # noqa: E402
from app.infrastructure.repositories.user_repository import SqlUserRepository  # noqa: E402
from app.infrastructure.security import BcryptHasher  # noqa: E402
from app.main import create_app  # noqa: E402

PASSWORD = "senha-segura-1"


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine):
    with Session(engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture
def client(engine):
    application = create_app()
    test_session = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    application.dependency_overrides[get_db] = override_get_db
    with TestClient(application) as test_client:
        yield test_client


@pytest.fixture
def make_user(db_session):
    repo = SqlUserRepository(db_session)
    hasher = BcryptHasher(rounds=4)
    counter = itertools.count(1)

    def _make(
        *, role=Role.ADMIN, email=None, password=PASSWORD, active=True, name="Usuário Teste"
    ) -> User:
        n = next(counter)
        return repo.add(
            User(
                id=None,
                name=name,
                email=email or f"user{n}@example.com",
                password_hash=hasher.hash(password),
                role=role,
                active=active,
            )
        )

    return _make


@pytest.fixture
def auth_header(client, make_user):
    """Cria um usuário com o perfil pedido, faz login pela API e devolve o header."""

    def _header(role=Role.ADMIN) -> dict[str, str]:
        user = make_user(role=role)
        response = client.post(
            "/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}
        )
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _header
```

- [ ] **Step 9: Escrever os testes — `backend/tests/test_auth_api.py`**

```python
from app.domain.roles import Role
from tests.conftest import PASSWORD


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_returns_bearer_token(client, make_user):
    make_user(email="admin@oficina.com")

    response = login(client, "admin@oficina.com")

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_is_case_insensitive_on_email(client, make_user):
    make_user(email="admin@oficina.com")

    assert login(client, "ADMIN@oficina.com").status_code == 200


def test_login_wrong_password_returns_401(client, make_user):
    make_user(email="admin@oficina.com")

    response = login(client, "admin@oficina.com", "senha-errada")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_failed"


def test_login_unknown_email_returns_same_401(client):
    response = login(client, "ninguem@oficina.com")

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Credenciais inválidas"


def test_login_inactive_user_returns_401(client, make_user):
    make_user(email="off@oficina.com", active=False)

    assert login(client, "off@oficina.com").status_code == 401


def test_login_missing_password_returns_validation_error(client):
    response = client.post("/api/v1/auth/login", json={"email": "a@b.com"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_me_returns_current_user(client, make_user):
    make_user(email="mec@oficina.com", role=Role.MECHANIC, name="Carlos")
    token = login(client, "mec@oficina.com").json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "mec@oficina.com"
    assert response.json()["role"] == "mechanic"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()


def test_me_without_token_returns_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_with_garbage_token_returns_401(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer lixo"})

    assert response.status_code == 401
```

- [ ] **Step 10: Teste unitário do AuthService (sem timing side channel) — `backend/tests/test_auth_service.py`**

```python
import pytest

from app.application.services.auth_service import AuthService
from app.domain.errors import AuthenticationError
from app.domain.roles import Role
from app.domain.user import User


class FakeUsers:
    """Implementa só o que o AuthService usa do Protocol UserRepository."""

    def __init__(self, *users: User) -> None:
        self._by_email = {u.email: u for u in users}

    def get_by_email(self, email: str) -> User | None:
        return self._by_email.get(email)


class SpyHasher:
    """Implementa o Protocol PasswordHasher; 'ok:<senha>' é o hash de <senha>."""

    def __init__(self) -> None:
        self.verify_calls: list[tuple[str, str]] = []

    def hash(self, password: str) -> str:
        return f"ok:{password}"

    def verify(self, password: str, password_hash: str) -> bool:
        self.verify_calls.append((password, password_hash))
        return password_hash == f"ok:{password}"


class FakeCodec:
    def encode(self, user_id: int, role: Role) -> str:
        return f"token-{user_id}-{role.value}"


def make_service(*users: User) -> tuple[AuthService, SpyHasher]:
    hasher = SpyHasher()
    return AuthService(FakeUsers(*users), hasher, FakeCodec()), hasher


def make_user(active: bool = True) -> User:
    return User(
        id=7,
        name="Ana",
        email="ana@oficina.com",
        password_hash="ok:segredo-123",
        role=Role.ADMIN,
        active=active,
    )


def test_unknown_email_still_verifies_once_and_fails():
    service, hasher = make_service()

    with pytest.raises(AuthenticationError):
        service.login("ninguem@oficina.com", "qualquer")

    assert len(hasher.verify_calls) == 1


def test_wrong_password_verifies_once_and_fails():
    service, hasher = make_service(make_user())

    with pytest.raises(AuthenticationError):
        service.login("ana@oficina.com", "errada")

    assert len(hasher.verify_calls) == 1


def test_inactive_user_with_correct_password_verifies_once_and_fails():
    service, hasher = make_service(make_user(active=False))

    with pytest.raises(AuthenticationError):
        service.login("ana@oficina.com", "segredo-123")

    assert len(hasher.verify_calls) == 1


def test_active_user_with_correct_password_gets_token():
    service, hasher = make_service(make_user())

    result = service.login("ANA@oficina.com", "segredo-123")

    assert result.access_token == "token-7-admin"
    assert len(hasher.verify_calls) == 1
```

Run: `python -m pytest tests/test_auth_service.py -v`
Expected: PASS (o verify é chamado exatamente uma vez em todos os cenários).

- [ ] **Step 11: Rodar a suíte inteira**

Run: `python -m pytest -v`
Expected: PASS em todos os testes (inclui `test_health`, `test_config`, `test_db_models`, `test_security`, `test_error_handlers`, `test_user_repository`, `test_auth_api`).

- [ ] **Step 12: Commit**

```powershell
git add app tests
git commit -m "feat: login JWT, /auth/me, DTOs, AuthService e injecao de dependencias" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: UserService e CRUD de usuários protegido por perfil (RBAC)

**Files:**
- Create: `backend/app/application/services/user_service.py`, `backend/app/presentation/routers/users.py`, `backend/tests/test_users_api.py`
- Modify: `backend/app/presentation/deps.py` (adiciona `get_user_service`), `backend/app/main.py` (registra router)

- [ ] **Step 1: Escrever o teste que falha — `backend/tests/test_users_api.py`**

```python
from app.domain.roles import Role

URL = "/api/v1/users"
NEW_USER = {
    "name": "Recepção Um",
    "email": "recepcao@oficina.com",
    "password": "senha-forte-9",
    "role": "reception",
}


def test_admin_creates_user_without_leaking_password(client, auth_header):
    response = client.post(URL, json=NEW_USER, headers=auth_header(Role.ADMIN))

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "recepcao@oficina.com"
    assert body["role"] == "reception"
    assert body["active"] is True
    assert "password" not in body and "password_hash" not in body


def test_created_user_can_log_in(client, auth_header):
    client.post(URL, json=NEW_USER, headers=auth_header(Role.ADMIN))

    response = client.post(
        "/api/v1/auth/login",
        json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
    )

    assert response.status_code == 200


def test_email_is_normalized_to_lowercase(client, auth_header):
    payload = {**NEW_USER, "email": "Recepcao@Oficina.COM"}

    response = client.post(URL, json=payload, headers=auth_header(Role.ADMIN))

    assert response.json()["email"] == "recepcao@oficina.com"


def test_duplicate_email_returns_409(client, auth_header):
    header = auth_header(Role.ADMIN)
    client.post(URL, json=NEW_USER, headers=header)

    response = client.post(URL, json=NEW_USER, headers=header)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_short_password_returns_422(client, auth_header):
    payload = {**NEW_USER, "password": "curta"}

    response = client.post(URL, json=payload, headers=auth_header(Role.ADMIN))

    assert response.status_code == 422


def test_non_admin_is_forbidden(client, auth_header):
    for role in (Role.RECEPTION, Role.MECHANIC):
        response = client.get(URL, headers=auth_header(role))
        assert response.status_code == 403


def test_without_token_returns_401(client):
    assert client.get(URL).status_code == 401


def test_list_paginates_and_searches(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    for i in range(4):
        make_user(email=f"extra{i}@oficina.com", name=f"Extra {i}")

    page = client.get(f"{URL}?page=2&size=2", headers=header).json()
    searched = client.get(f"{URL}?q=extra3", headers=header).json()

    assert page["total"] == 5
    assert page["page"] == 2 and page["size"] == 2
    assert len(page["items"]) == 2
    assert searched["total"] == 1
    assert searched["items"][0]["email"] == "extra3@oficina.com"


def test_list_rejects_invalid_page_size(client, auth_header):
    response = client.get(f"{URL}?size=1000", headers=auth_header(Role.ADMIN))

    assert response.status_code == 422


def test_get_user_by_id_and_missing(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")

    found = client.get(f"{URL}/{other.id}", headers=header)
    missing = client.get(f"{URL}/9999", headers=header)

    assert found.status_code == 200 and found.json()["email"] == "outro@oficina.com"
    assert missing.status_code == 404


def test_patch_updates_role_name_and_active(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com", role=Role.RECEPTION)

    response = client.patch(
        f"{URL}/{other.id}",
        json={"name": "Novo Nome", "role": "mechanic", "active": False},
        headers=header,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Novo Nome"
    assert body["role"] == "mechanic"
    assert body["active"] is False


def test_patch_password_changes_login(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")

    client.patch(f"{URL}/{other.id}", json={"password": "nova-senha-77"}, headers=header)

    ok = client.post(
        "/api/v1/auth/login", json={"email": "outro@oficina.com", "password": "nova-senha-77"}
    )
    assert ok.status_code == 200


def test_delete_is_soft_and_returns_404_afterwards(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")

    deleted = client.delete(f"{URL}/{other.id}", headers=header)
    after = client.get(f"{URL}/{other.id}", headers=header)

    assert deleted.status_code == 204
    assert after.status_code == 404


def test_deleted_user_cannot_log_in_and_email_stays_reserved(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")
    client.delete(f"{URL}/{other.id}", headers=header)

    login = client.post(
        "/api/v1/auth/login", json={"email": "outro@oficina.com", "password": "senha-segura-1"}
    )
    recreate = client.post(URL, json={**NEW_USER, "email": "outro@oficina.com"}, headers=header)

    assert login.status_code == 401
    assert recreate.status_code == 409


def test_admin_cannot_delete_self(client, auth_header):
    header = auth_header(Role.ADMIN)
    me = client.get("/api/v1/auth/me", headers=header).json()

    response = client.delete(f"{URL}/{me['id']}", headers=header)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "business_rule_violation"


def test_delete_missing_returns_404(client, auth_header):
    response = client.delete(f"{URL}/9999", headers=auth_header(Role.ADMIN))

    assert response.status_code == 404
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_users_api.py -v`
Expected: FAIL (rotas inexistentes → 404 nos testes de criação).

- [ ] **Step 3: Criar `backend/app/application/services/user_service.py`**

```python
from app.application.dtos.common import Page
from app.application.dtos.user import UserCreate, UserOut, UserUpdate
from app.application.ports import PasswordHasher
from app.domain.errors import BusinessRuleError, ConflictError, NotFoundError
from app.domain.user import User, UserRepository


class UserService:
    def __init__(self, users: UserRepository, hasher: PasswordHasher) -> None:
        self._users = users
        self._hasher = hasher

    def create(self, data: UserCreate) -> UserOut:
        email = data.email.lower()
        if self._users.email_exists(email):
            raise ConflictError("E-mail já cadastrado")
        saved = self._users.add(
            User(
                id=None,
                name=data.name,
                email=email,
                password_hash=self._hasher.hash(data.password),
                role=data.role,
            )
        )
        return UserOut.from_entity(saved)

    def get(self, user_id: int) -> UserOut:
        return UserOut.from_entity(self._get_or_404(user_id))

    def list_users(self, *, page: int, size: int, search: str | None) -> Page[UserOut]:
        users, total = self._users.list_page(
            offset=(page - 1) * size, limit=size, search=search
        )
        return Page[UserOut](
            items=[UserOut.from_entity(u) for u in users], total=total, page=page, size=size
        )

    def update(self, user_id: int, data: UserUpdate) -> UserOut:
        user = self._get_or_404(user_id)
        if data.name is not None:
            user.name = data.name
        if data.role is not None:
            user.role = data.role
        if data.active is not None:
            user.active = data.active
        if data.password is not None:
            user.password_hash = self._hasher.hash(data.password)
        return UserOut.from_entity(self._users.update(user))

    def delete(self, user_id: int, *, actor_id: int) -> None:
        if user_id == actor_id:
            raise BusinessRuleError("Você não pode excluir o próprio usuário")
        self._get_or_404(user_id)
        self._users.soft_delete(user_id)

    def _get_or_404(self, user_id: int) -> User:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado")
        return user
```

- [ ] **Step 4: Em `backend/app/presentation/deps.py`, adicionar o import e o provider**

Adicionar junto dos outros imports:
```python
from app.application.services.user_service import UserService
```
Adicionar após `get_auth_service`:
```python
def get_user_service(
    users: SqlUserRepository = Depends(get_user_repository),
    hasher: BcryptHasher = Depends(get_hasher),
) -> UserService:
    return UserService(users, hasher)
```

- [ ] **Step 5: Criar `backend/app/presentation/routers/users.py`**

```python
from fastapi import APIRouter, Depends, Query, Response, status

from app.application.dtos.common import Page
from app.application.dtos.user import UserCreate, UserOut, UserUpdate
from app.application.services.user_service import UserService
from app.domain.roles import Role
from app.domain.user import User
from app.presentation.deps import get_user_service, require_roles

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_roles(Role.ADMIN))],
)


@router.get("", response_model=Page[UserOut])
def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    service: UserService = Depends(get_user_service),
):
    return service.list_users(page=page, size=size, search=q)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, service: UserService = Depends(get_user_service)):
    return service.create(body)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, service: UserService = Depends(get_user_service)):
    return service.get(user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, body: UserUpdate, service: UserService = Depends(get_user_service)
):
    return service.update(user_id, body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    actor: User = Depends(require_roles(Role.ADMIN)),
    service: UserService = Depends(get_user_service),
):
    service.delete(user_id, actor_id=actor.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 6: Em `backend/app/main.py`, registrar o router**

Trocar o import `from app.presentation.routers import auth` por:
```python
from app.presentation.routers import auth, users
```
E, abaixo de `app.include_router(auth.router, prefix="/api/v1")`, adicionar:
```python
    app.include_router(users.router, prefix="/api/v1")
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `python -m pytest -v`
Expected: PASS em todos os testes (16 novos em `test_users_api.py`).

- [ ] **Step 8: Commit**

```powershell
git add app tests
git commit -m "feat: CRUD de usuarios com RBAC (somente admin), paginacao e busca" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Alembic (migrations) com migração inicial da tabela users

**Files:**
- Create: `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/script.py.mako`, `backend/migrations/versions/0001_create_users.py`, `backend/tests/test_migrations.py`

- [ ] **Step 1: Escrever o teste que falha — `backend/tests/test_migrations.py`**

```python
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

BACKEND = Path(__file__).resolve().parent.parent


def alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def test_upgrade_creates_users_and_downgrade_removes_it(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "head")
    inspector = inspect(create_engine(url))
    columns = {c["name"] for c in inspector.get_columns("users")}

    assert "users" in inspector.get_table_names()
    assert {
        "id", "name", "email", "password_hash", "role", "active",
        "created_at", "updated_at", "deleted_at",
    } <= columns
    assert any(ix["unique"] and ix["column_names"] == ["email"] for ix in inspector.get_indexes("users"))

    command.downgrade(cfg, "base")
    assert "users" not in inspect(create_engine(url)).get_table_names()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_migrations.py -v`
Expected: FAIL (`alembic.ini` inexistente / script_location inválido).

- [ ] **Step 3: Criar `backend/alembic.ini`**

```ini
[alembic]
script_location = migrations
sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 4: Criar `backend/migrations/env.py`**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.infrastructure.db.models  # noqa: F401  (registra tabelas no metadata)
from app.infrastructure.config import get_settings
from app.infrastructure.db.base import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _database_url() -> str:
    """URL do alembic.ini/teste, ou a DATABASE_URL das Settings."""
    return config.get_main_option("sqlalchemy.url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, render_as_batch=True
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 5: Criar `backend/migrations/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 6: Criar `backend/migrations/versions/0001_create_users.py`**

```python
"""create users

Revision ID: 0001
Revises:
Create Date: 2026-11-05
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
```

- [ ] **Step 7: Rodar e ver passar**

Run: `python -m pytest tests/test_migrations.py -v`
Expected: PASS (1 passed).

- [ ] **Step 8: Commit**

```powershell
git add alembic.ini migrations tests/test_migrations.py
git commit -m "feat: alembic configurado com migracao inicial da tabela users" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: CLI para criar o primeiro administrador

**Files:**
- Create: `backend/app/cli.py`, `backend/tests/test_cli.py`

- [ ] **Step 1: Escrever o teste que falha — `backend/tests/test_cli.py`**

```python
import pytest
from sqlalchemy.orm import sessionmaker

from app.cli import run
from app.domain.roles import Role
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.security import BcryptHasher


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


ARGS = [
    "create-admin",
    "--name", "Admin Geral",
    "--email", "admin@oficina.com",
    "--password", "senha-forte-9",
]


def test_create_admin_persists_admin_user(session_factory):
    code = run(ARGS, session_factory=session_factory, hasher=BcryptHasher(rounds=4))

    with session_factory() as db:
        user = SqlUserRepository(db).get_by_email("admin@oficina.com")
    assert code == 0
    assert user is not None and user.role is Role.ADMIN


def test_create_admin_twice_fails_with_exit_code_1(session_factory, capsys):
    hasher = BcryptHasher(rounds=4)
    run(ARGS, session_factory=session_factory, hasher=hasher)

    code = run(ARGS, session_factory=session_factory, hasher=hasher)

    assert code == 1
    assert "já cadastrado" in capsys.readouterr().err
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_cli.py -v`
Expected: FAIL com `ImportError: cannot import name 'run' from 'app.cli'` (módulo inexistente).

- [ ] **Step 3: Criar `backend/app/cli.py`**

```python
import argparse
import sys
from collections.abc import Callable, Sequence

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.application.dtos.user import UserCreate
from app.application.ports import PasswordHasher
from app.application.services.user_service import UserService
from app.domain.errors import AppError
from app.domain.roles import Role
from app.infrastructure.config import get_settings
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.security import BcryptHasher


def run(
    argv: Sequence[str] | None = None,
    *,
    session_factory: Callable[[], Session] = SessionLocal,
    hasher: PasswordHasher | None = None,
) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-admin", help="Cria um usuário administrador")
    create.add_argument("--name", required=True)
    create.add_argument("--email", required=True)
    create.add_argument("--password", required=True)
    args = parser.parse_args(argv)

    hasher = hasher or BcryptHasher(rounds=get_settings().bcrypt_rounds)
    try:
        with session_factory() as db:
            service = UserService(SqlUserRepository(db), hasher)
            created = service.create(
                UserCreate(
                    name=args.name, email=args.email, password=args.password, role=Role.ADMIN
                )
            )
    except (AppError, ValidationError) as exc:
        message = exc.message if isinstance(exc, AppError) else str(exc)
        print(f"Erro: {message}", file=sys.stderr)
        return 1

    print(f"Administrador criado: {created.email} (id {created.id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_cli.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```powershell
git add app/cli.py tests/test_cli.py
git commit -m "feat: CLI create-admin para criar o primeiro administrador" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verificação manual, lint, CI e README

**Files:**
- Create: `.github/workflows/ci.yml`, `backend/README.md`

- [ ] **Step 1: Lint**

Run: `ruff check . --fix` e depois `ruff check .`
Expected: `All checks passed!`. Corrigir o que o `--fix` não resolver (ordem de imports, linhas > 100).

- [ ] **Step 2: Suíte completa**

Run: `python -m pytest -q`
Expected: todos os testes passando, 0 falhas.

- [ ] **Step 3: Verificação ponta a ponta com banco real (SQLite de dev)**

```powershell
Copy-Item .env.example .env
alembic upgrade head
python -m app.cli create-admin --name "Admin" --email admin@oficina.com --password "senha-forte-9"
uvicorn app.main:app --port 8000
```
Expected: migration `0001` aplicada, `Administrador criado: admin@oficina.com (id 1)`, servidor sobe em `http://127.0.0.1:8000`.

Em outro terminal:
```powershell
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@oficina.com\",\"password\":\"senha-forte-9\"}'
```
Expected: `{"status":"ok"}` e um JSON com `access_token`. Abrir `http://127.0.0.1:8000/docs` e confirmar que o Swagger lista `auth` e `users`. Encerrar o servidor (Ctrl+C) e apagar `autocenter.db` se quiser recomeçar.

- [ ] **Step 4: Criar `.github/workflows/ci.yml` (na raiz do repositório)**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements-dev.txt
      - run: pip install -r requirements-dev.txt
      - run: ruff check .
      - run: python -m pytest -q
```

- [ ] **Step 5: Criar `backend/README.md`**

````markdown
# Auto Center — Backend

API FastAPI do sistema de gestão para Auto Center (Projeto Integrado UNIFEOB).

## Rodando localmente

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
alembic upgrade head
python -m app.cli create-admin --name "Admin" --email admin@oficina.com --password "senha-forte-9"
uvicorn app.main:app --reload
```

Swagger: http://127.0.0.1:8000/docs

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
````

- [ ] **Step 6: Commit**

```powershell
cd ..
git add .github backend/README.md backend
git commit -m "chore: CI no GitHub Actions, README do backend e ajustes de lint" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Publicar no GitHub (quando o repositório existir)**

```powershell
git remote add origin https://github.com/<seu-usuario>/<repositorio>.git
git push -u origin main
```
Expected: o workflow **CI** roda na aba *Actions* e fica verde.

---

## Self-Review

**Cobertura do design (escopo deste plano):** autenticação JWT e RBAC por perfil (Tasks 4, 7, 8); Pydantic/DTOs (7); Repository + Service + DI (6, 7, 8); tratamento global de exceções (5); paginação, busca e filtros (6, 8); soft delete (3, 6, 8); logs (7, `basicConfig` + `logger.exception` na Task 5); Swagger (automático do FastAPI, conferido na Task 11); Alembic (9); CI no GitHub Actions (11); segurança (bcrypt, segredo forte em produção, mensagem única de login, senha nunca na resposta). Auditoria `created_by/updated_by` entra nas tabelas de negócio no Plano 2. CD/deploy, S3, motor preventivo, frontend e demais módulos estão nos Planos 2–4.

**Placeholders:** nenhum "TBD"/"TODO"; todos os passos de código trazem o código completo e os comandos com a saída esperada.

**Consistência de tipos:** `Role`, `User`, `UserRepository` (`get_by_id`, `get_by_email`, `email_exists`, `add`, `update`, `soft_delete`, `list_page`), `PasswordHasher.hash/verify`, `TokenCodec.encode`, `JwtCodec.decode → TokenPayload(user_id, role)`, `BcryptHasher(rounds)`, `UserService.create/get/list_users/update/delete(actor_id=)` e `AuthService.login` têm os mesmos nomes e assinaturas em testes, serviços e routers. `tests.conftest.PASSWORD` é importado em `test_auth_api.py` (pacote `tests/` com `__init__.py`, `pythonpath = ["."]`).

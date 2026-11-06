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

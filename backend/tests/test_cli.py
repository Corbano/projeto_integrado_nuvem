import pytest
from sqlalchemy.orm import sessionmaker

from app.cli import run
from app.domain.roles import Role
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.security import BcryptHasher


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


BASE_ARGS = [
    "create-admin",
    "--name", "Admin Geral",
    "--email", "admin@oficina.com",
]
ARGS = [*BASE_ARGS, "--password", "senha-forte-9"]


def _fail_prompt(_: str) -> str:
    raise AssertionError("o prompt não deveria ser chamado")


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


def test_create_admin_password_from_env_var(session_factory, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "senha-forte-9")

    code = run(
        BASE_ARGS,
        session_factory=session_factory,
        hasher=BcryptHasher(rounds=4),
        prompt_password=_fail_prompt,
    )

    with session_factory() as db:
        user = SqlUserRepository(db).get_by_email("admin@oficina.com")
    assert code == 0
    assert user is not None and user.role is Role.ADMIN


def test_create_admin_argument_takes_precedence_over_env(session_factory, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "x")  # curta: falharia se fosse usada

    code = run(
        ARGS,
        session_factory=session_factory,
        hasher=BcryptHasher(rounds=4),
        prompt_password=_fail_prompt,
    )

    assert code == 0


def test_create_admin_prompts_when_no_argument_and_no_env(session_factory, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    prompts: list[str] = []

    def fake_prompt(text: str) -> str:
        prompts.append(text)
        return "senha-forte-9"

    code = run(
        BASE_ARGS,
        session_factory=session_factory,
        hasher=BcryptHasher(rounds=4),
        prompt_password=fake_prompt,
    )

    with session_factory() as db:
        user = SqlUserRepository(db).get_by_email("admin@oficina.com")
    assert code == 0
    assert prompts == ["Senha: "]
    assert user is not None


def test_create_admin_empty_env_falls_back_to_prompt(session_factory, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "")

    code = run(
        BASE_ARGS,
        session_factory=session_factory,
        hasher=BcryptHasher(rounds=4),
        prompt_password=lambda _: "senha-forte-9",
    )

    assert code == 0


def test_create_admin_short_password_fails_without_echoing_it(
    session_factory, monkeypatch, capsys
):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    code = run(
        BASE_ARGS,
        session_factory=session_factory,
        hasher=BcryptHasher(rounds=4),
        prompt_password=lambda _: "curta",
    )

    captured = capsys.readouterr()
    assert code == 1
    assert captured.err.startswith("Erro:")
    assert "curta" not in captured.err
    assert "curta" not in captured.out

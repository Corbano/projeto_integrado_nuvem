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

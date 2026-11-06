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

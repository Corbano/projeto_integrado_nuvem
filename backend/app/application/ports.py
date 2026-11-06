from typing import Protocol

from app.domain.roles import Role


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password: str, password_hash: str) -> bool: ...


class TokenCodec(Protocol):
    def encode(self, user_id: int, role: Role) -> str: ...


class UnitOfWork(Protocol):
    """Fronteira de transação (commit/rollback) compartilhada pelos repositórios."""

    def commit(self) -> None: ...

    def rollback(self) -> None: ...

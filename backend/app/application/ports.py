from dataclasses import dataclass, field
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


@dataclass(frozen=True)
class PresignedUpload:
    """Instruções para o cliente enviar o arquivo direto ao armazenamento."""

    url: str
    method: str
    fields: dict[str, str] = field(default_factory=dict)  # campos do form (POST do S3)
    headers: dict[str, str] = field(default_factory=dict)  # cabeçalhos a enviar


@dataclass(frozen=True)
class StoredObject:
    size_bytes: int
    content_type: str | None


class FileStorage(Protocol):
    """Armazenamento de objetos (S3 em produção, disco local em dev/testes)."""

    def presign_upload(
        self, key: str, content_type: str, max_bytes: int, expires_in: int = 900
    ) -> PresignedUpload: ...

    def presign_download(self, key: str, expires_in: int = 900) -> str: ...

    def exists(self, key: str) -> bool: ...

    def stat(self, key: str) -> StoredObject | None:
        """Tamanho e tipo do objeto, ou `None` se não existir."""
        ...

    def delete(self, key: str) -> None:
        """Idempotente: apagar um objeto inexistente não é erro."""
        ...

"""Check-in de veículo: entidades, regras puras (checklist, fotos) e portas dos repositórios."""

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from app.domain.errors import BusinessRuleError

MAX_PHOTOS_PER_CHECKIN = 10
MAX_PHOTO_BYTES = 8 * 1024 * 1024
PHOTO_URL_EXPIRES_SECONDS = 15 * 60

# Tipo permitido -> extensão do objeto (nunca derivada do nome enviado pelo usuário).
PHOTO_EXTENSIONS: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class FuelLevel(StrEnum):
    EMPTY = "vazio"
    QUARTER = "quarto"
    HALF = "meio"
    THREE_QUARTERS = "tres_quartos"
    FULL = "cheio"


class ChecklistItem(StrEnum):
    TIRES = "pneus"
    SUSPENSION = "suspensao"
    BRAKES = "freios"
    LIGHTING = "iluminacao"
    BATTERY = "bateria"
    AIR_CONDITIONING = "ar_condicionado"
    WIPERS = "limpadores"


class Condition(StrEnum):
    OK = "ok"
    ATTENTION = "atencao"
    CRITICAL = "critico"


def photo_extension(content_type: str) -> str:
    """Extensão do objeto para um tipo permitido; qualquer outro tipo é rejeitado."""
    try:
        return PHOTO_EXTENSIONS[content_type]
    except KeyError:
        raise BusinessRuleError("Tipo de imagem não permitido (use JPEG, PNG ou WebP)") from None


def photo_storage_key(checkin_id: int, photo_uuid: str, content_type: str) -> str:
    return f"checkins/{checkin_id}/{photo_uuid}.{photo_extension(content_type)}"


def validate_photo(content_type: str, size_bytes: int) -> None:
    photo_extension(content_type)
    if not 0 < size_bytes <= MAX_PHOTO_BYTES:
        raise BusinessRuleError("A foto deve ter entre 1 byte e 8 MB")


def validate_checklist(items: Iterable[ChecklistItem]) -> None:
    """Os 7 itens do checklist são obrigatórios, cada um exatamente uma vez."""
    seen = list(items)
    duplicated = sorted({i.value for i in seen if seen.count(i) > 1})
    if duplicated:
        raise BusinessRuleError(f"Itens do checklist repetidos: {', '.join(duplicated)}")
    missing = [i.value for i in ChecklistItem if i not in seen]
    if missing:
        raise BusinessRuleError(f"Itens obrigatórios do checklist ausentes: {', '.join(missing)}")


@dataclass
class ChecklistEntry:
    item: ChecklistItem
    condition: Condition
    note: str | None = None


@dataclass
class CheckinPhoto:
    id: int | None
    checkin_id: int
    storage_key: str
    content_type: str
    size_bytes: int
    created_at: datetime | None = None
    confirmed_at: datetime | None = None

    @property
    def confirmed(self) -> bool:
        return self.confirmed_at is not None


@dataclass
class Checkin:
    id: int | None
    vehicle_id: int
    user_id: int
    km: int
    fuel_level: FuelLevel
    damages: str | None = None
    accessories: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    created_by_id: int | None = None
    checklist: list[ChecklistEntry] = field(default_factory=list)
    photos: list[CheckinPhoto] = field(default_factory=list)


class CheckinRepository(Protocol):
    def add(self, checkin: Checkin) -> Checkin:
        """Insere o check-in com o checklist, sem confirmar a transação."""
        ...

    def get_by_id(self, checkin_id: int) -> Checkin | None:
        """Com checklist e fotos."""
        ...

    def list_page(
        self, *, offset: int, limit: int, vehicle_id: int | None = None
    ) -> tuple[list[Checkin], int]:
        """Mais recentes primeiro; sem checklist/fotos."""
        ...


class CheckinPhotoRepository(Protocol):
    def add(self, photo: CheckinPhoto) -> CheckinPhoto:
        """Sem commit."""
        ...

    def get(self, checkin_id: int, photo_id: int) -> CheckinPhoto | None: ...

    def count_active(self, checkin_id: int, *, pending_since: datetime) -> int:
        """Fotos confirmadas + pendentes criadas a partir de `pending_since`."""
        ...

    def count_confirmed(self, checkin_id: int) -> int: ...

    def mark_confirmed(self, photo_id: int, *, size_bytes: int, at: datetime) -> None:
        """Sem commit."""
        ...

    def delete(self, photo_id: int) -> None:
        """Sem commit."""
        ...

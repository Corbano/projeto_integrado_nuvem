"""Leituras de quilometragem: entidade, regra pura de atualização e porta do repositório."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from app.domain.errors import BusinessRuleError

MAX_KM = 5_000_000
KM_CANNOT_DECREASE = "A quilometragem não pode diminuir"


class KmSource(StrEnum):
    MANUAL = "manual"
    CHECKIN = "checkin"
    SERVICE_ORDER = "service_order"


def validate_km_update(current_km: int, new_km: int, is_admin_force: bool) -> bool:
    """Valida a mudança de quilometragem.

    Devolve `True` quando uma leitura deve ser registrada e `False` quando o valor é igual
    ao atual (idempotente, nada a fazer). Diminuir só é permitido com `is_admin_force`.
    """
    if not 0 <= new_km <= MAX_KM:
        raise BusinessRuleError(f"A quilometragem deve estar entre 0 e {MAX_KM}")
    if new_km == current_km:
        return False
    if new_km < current_km and not is_admin_force:
        raise BusinessRuleError(KM_CANNOT_DECREASE)
    return True


@dataclass
class KmReading:
    id: int | None
    vehicle_id: int
    km: int
    source: KmSource
    recorded_by_id: int | None
    note: str | None = None
    created_at: datetime | None = None


class KmReadingRepository(Protocol):
    def add(self, reading: KmReading) -> KmReading:
        """Insere sem confirmar a transação (quem orquestra faz o commit)."""
        ...

    def latest_for_vehicle(self, vehicle_id: int) -> KmReading | None: ...

    def list_page(
        self, vehicle_id: int, *, offset: int, limit: int
    ) -> tuple[list[KmReading], int]:
        """Mais recentes primeiro."""
        ...

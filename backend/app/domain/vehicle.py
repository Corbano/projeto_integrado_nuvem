"""Entidade Veículo, regras puras (placa, chassi, renavam, ano) e porta do repositório."""

import re
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Protocol


class Fuel(StrEnum):
    GASOLINA = "gasolina"
    ETANOL = "etanol"
    FLEX = "flex"
    DIESEL = "diesel"
    GNV = "gnv"
    ELETRICO = "eletrico"
    HIBRIDO = "hibrido"


MIN_YEAR = 1950

_PLATE = re.compile(r"[A-Z]{3}[0-9]([0-9]|[A-Z])[0-9]{2}", re.ASCII)
_CHASSIS = re.compile(r"[A-HJ-NPR-Z0-9]{17}", re.ASCII)
_RENAVAM = re.compile(r"[0-9]{9,11}", re.ASCII)


def normalize_plate(value: str) -> str:
    """Maiúscula, sem espaços nas pontas e sem o hífen opcional após as 3 letras."""
    plate = value.strip().upper()
    if len(plate) > 3 and plate[3] == "-":
        plate = plate[:3] + plate[4:]
    return plate


def is_valid_plate(value: str) -> bool:
    """Formato antigo (AAA9999) ou Mercosul (AAA9A99)."""
    return _PLATE.fullmatch(normalize_plate(value)) is not None


def normalize_chassis(value: str) -> str:
    return value.strip().upper()


def is_valid_chassis(value: str) -> bool:
    """VIN: 17 caracteres alfanuméricos, sem I, O e Q."""
    return _CHASSIS.fullmatch(normalize_chassis(value)) is not None


def is_valid_renavam(value: str) -> bool:
    return _RENAVAM.fullmatch(value) is not None


def is_valid_year(year: int, *, current_year: int | None = None) -> bool:
    """De 1950 até o ano atual + 1 (modelos do próximo ano)."""
    limit = (current_year if current_year is not None else date.today().year) + 1
    return MIN_YEAR <= year <= limit


@dataclass
class Vehicle:
    id: int | None
    customer_id: int
    plate: str
    brand: str
    model: str
    year: int
    fuel: Fuel
    color: str
    engine: str | None = None
    chassis: str | None = None
    renavam: str | None = None
    current_km: int = 0
    created_by_id: int | None = None
    updated_by_id: int | None = None


class VehicleRepository(Protocol):
    def get_by_id(self, vehicle_id: int) -> Vehicle | None: ...

    def plate_exists(self, plate: str, *, exclude_id: int | None = None) -> bool:
        """Considera apenas veículos não excluídos."""
        ...

    def chassis_exists(self, chassis: str, *, exclude_id: int | None = None) -> bool:
        """Considera apenas veículos não excluídos."""
        ...

    def add(self, vehicle: Vehicle) -> Vehicle: ...

    def update(self, vehicle: Vehicle) -> Vehicle:
        """Não altera `current_km` (só o fluxo de quilometragem faz isso)."""
        ...

    def soft_delete(self, vehicle_id: int, *, actor_id: int | None = None) -> None: ...

    def list_page(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None,
        customer_id: int | None = None,
    ) -> tuple[list[Vehicle], int]: ...

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.vehicle import (
    Fuel,
    Vehicle,
    is_valid_chassis,
    is_valid_plate,
    is_valid_renavam,
    is_valid_year,
    normalize_chassis,
    normalize_plate,
)


def _plate(value: str) -> str:
    if not is_valid_plate(value):
        raise ValueError("Placa inválida (use AAA9999 ou AAA9A99)")
    return normalize_plate(value)


def _chassis(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    if not is_valid_chassis(value):
        raise ValueError("Chassi inválido (17 caracteres, sem I, O e Q)")
    return normalize_chassis(value)


def _renavam(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if not is_valid_renavam(value):
        raise ValueError("Renavam deve ter de 9 a 11 dígitos")
    return value


def _year(value: int) -> int:
    if not is_valid_year(value):
        raise ValueError("Ano fora do intervalo permitido")
    return value


def _text(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


def _required_text(value: str | None) -> str:
    if value is None:
        raise ValueError("Campo não pode ser nulo")
    value = value.strip()
    if not value:
        raise ValueError("Campo não pode ser vazio")
    return value


class VehicleCreate(BaseModel):
    # `current_km` não é aceito aqui (começa em 0; só muda pelo fluxo de quilometragem).
    model_config = ConfigDict(extra="forbid")

    customer_id: int = Field(ge=1)
    plate: str = Field(max_length=16)
    brand: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=60)
    year: int
    engine: str | None = Field(default=None, max_length=60)
    fuel: Fuel
    color: str = Field(min_length=1, max_length=40)
    chassis: str | None = Field(default=None, max_length=32)
    renavam: str | None = Field(default=None, max_length=32)

    @field_validator("plate")
    @classmethod
    def _v_plate(cls, value: str) -> str:
        return _plate(value)

    @field_validator("brand", "model", "color")
    @classmethod
    def _v_required(cls, value: str) -> str:
        return _required_text(value)

    @field_validator("year")
    @classmethod
    def _v_year(cls, value: int) -> int:
        return _year(value)

    @field_validator("engine")
    @classmethod
    def _v_engine(cls, value: str | None) -> str | None:
        return _text(value)

    @field_validator("chassis")
    @classmethod
    def _v_chassis(cls, value: str | None) -> str | None:
        return _chassis(value)

    @field_validator("renavam")
    @classmethod
    def _v_renavam(cls, value: str | None) -> str | None:
        return _renavam(value)


class VehicleUpdate(BaseModel):
    """PATCH: campos ausentes não mudam; `null` limpa engine/chassis/renavam."""

    model_config = ConfigDict(extra="forbid")

    customer_id: int | None = Field(default=None, ge=1)
    plate: str | None = Field(default=None, max_length=16)
    brand: str | None = Field(default=None, max_length=60)
    model: str | None = Field(default=None, max_length=60)
    year: int | None = None
    engine: str | None = Field(default=None, max_length=60)
    fuel: Fuel | None = None
    color: str | None = Field(default=None, max_length=40)
    chassis: str | None = Field(default=None, max_length=32)
    renavam: str | None = Field(default=None, max_length=32)

    @field_validator("customer_id", "plate", "brand", "model", "year", "fuel", "color")
    @classmethod
    def _not_null(cls, value):
        if value is None:
            raise ValueError("Campo não pode ser nulo")
        return value

    @field_validator("plate")
    @classmethod
    def _v_plate(cls, value: str) -> str:
        return _plate(value)

    @field_validator("brand", "model", "color")
    @classmethod
    def _v_required(cls, value: str) -> str:
        return _required_text(value)

    @field_validator("year")
    @classmethod
    def _v_year(cls, value: int) -> int:
        return _year(value)

    @field_validator("engine")
    @classmethod
    def _v_engine(cls, value: str | None) -> str | None:
        return _text(value)

    @field_validator("chassis")
    @classmethod
    def _v_chassis(cls, value: str | None) -> str | None:
        return _chassis(value)

    @field_validator("renavam")
    @classmethod
    def _v_renavam(cls, value: str | None) -> str | None:
        return _renavam(value)


class VehicleOut(BaseModel):
    id: int
    customer_id: int
    plate: str
    brand: str
    model: str
    year: int
    engine: str | None
    fuel: Fuel
    color: str
    chassis: str | None
    renavam: str | None
    current_km: int

    @classmethod
    def from_entity(cls, vehicle: Vehicle) -> "VehicleOut":
        return cls(**_fields(vehicle))


class CustomerSummary(BaseModel):
    id: int
    name: str


class VehicleDetailOut(VehicleOut):
    customer: CustomerSummary | None

    @classmethod
    def from_entity(
        cls, vehicle: Vehicle, customer: CustomerSummary | None = None
    ) -> "VehicleDetailOut":
        return cls(**_fields(vehicle), customer=customer)


def _fields(vehicle: Vehicle) -> dict:
    return {
        "id": vehicle.id,
        "customer_id": vehicle.customer_id,
        "plate": vehicle.plate,
        "brand": vehicle.brand,
        "model": vehicle.model,
        "year": vehicle.year,
        "engine": vehicle.engine,
        "fuel": vehicle.fuel,
        "color": vehicle.color,
        "chassis": vehicle.chassis,
        "renavam": vehicle.renavam,
        "current_km": vehicle.current_km,
    }

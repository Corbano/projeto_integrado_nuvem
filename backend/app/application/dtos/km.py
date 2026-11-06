from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.km import MAX_KM, KmReading, KmSource


class KmRegister(BaseModel):
    # `source` não é aceito: a API pública registra sempre como `manual`.
    model_config = ConfigDict(extra="forbid")

    km: int = Field(ge=0, le=MAX_KM, strict=True)
    note: str | None = Field(default=None, max_length=500)
    force: bool = Field(default=False, strict=True)

    @field_validator("note")
    @classmethod
    def _v_note(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return value.strip()


class KmReadingOut(BaseModel):
    id: int
    vehicle_id: int
    km: int
    source: KmSource
    note: str | None
    recorded_by_id: int | None
    created_at: datetime | None

    @classmethod
    def from_entity(cls, reading: KmReading) -> "KmReadingOut":
        return cls(
            id=reading.id,
            vehicle_id=reading.vehicle_id,
            km=reading.km,
            source=reading.source,
            note=reading.note,
            recorded_by_id=reading.recorded_by_id,
            created_at=reading.created_at,
        )

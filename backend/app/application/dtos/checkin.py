from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.checkin import (
    MAX_PHOTO_BYTES,
    Checkin,
    ChecklistItem,
    Condition,
    FuelLevel,
)
from app.domain.km import MAX_KM


def _clean(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


class ChecklistEntryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item: ChecklistItem
    condition: Condition
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def _v_note(cls, value: str | None) -> str | None:
        return _clean(value)


class CheckinCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_id: int = Field(ge=1, strict=True)
    km: int = Field(ge=0, le=MAX_KM, strict=True)
    fuel_level: FuelLevel
    damages: str | None = Field(default=None, max_length=2000)
    accessories: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=2000)
    checklist: list[ChecklistEntryIn] = Field(max_length=len(ChecklistItem))

    @field_validator("damages", "accessories", "notes")
    @classmethod
    def _v_text(cls, value: str | None) -> str | None:
        return _clean(value)


class PhotoPresignIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size_bytes: int = Field(ge=1, le=MAX_PHOTO_BYTES, strict=True)


class PresignedUploadOut(BaseModel):
    url: str
    method: str
    fields: dict[str, str]
    headers: dict[str, str]


class PhotoPresignOut(BaseModel):
    photo_id: int
    upload: PresignedUploadOut
    expires_in: int


class ChecklistEntryOut(BaseModel):
    item: ChecklistItem
    condition: Condition
    note: str | None


class PhotoOut(BaseModel):
    id: int
    content_type: str
    size_bytes: int
    status: Literal["pending", "confirmed"]
    created_at: datetime | None
    confirmed_at: datetime | None
    # Só para fotos confirmadas; expira em 15 minutos.
    download_url: str | None


class CheckinSummaryOut(BaseModel):
    id: int
    vehicle_id: int
    user_id: int
    km: int
    fuel_level: FuelLevel
    damages: str | None
    accessories: str | None
    notes: str | None
    created_at: datetime | None
    created_by_id: int | None

    @classmethod
    def from_entity(cls, checkin: Checkin) -> "CheckinSummaryOut":
        return cls(
            id=checkin.id,
            vehicle_id=checkin.vehicle_id,
            user_id=checkin.user_id,
            km=checkin.km,
            fuel_level=checkin.fuel_level,
            damages=checkin.damages,
            accessories=checkin.accessories,
            notes=checkin.notes,
            created_at=checkin.created_at,
            created_by_id=checkin.created_by_id,
        )


class CheckinOut(CheckinSummaryOut):
    download_expires_in: int
    checklist: list[ChecklistEntryOut]
    photos: list[PhotoOut]

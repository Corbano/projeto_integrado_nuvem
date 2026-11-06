from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class CheckinModel(Base):
    __tablename__ = "checkins"
    __table_args__ = (
        Index("ix_checkins_vehicle_id_created_at", "vehicle_id", "created_at"),
        CheckConstraint("km >= 0 AND km <= 5000000", name="ck_checkins_km_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    km: Mapped[int] = mapped_column(Integer, nullable=False)
    fuel_level: Mapped[str] = mapped_column(String(16), nullable=False)
    damages: Mapped[str | None] = mapped_column(Text, nullable=True)
    accessories: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class CheckinChecklistItemModel(Base):
    __tablename__ = "checkin_checklist_items"
    __table_args__ = (
        UniqueConstraint("checkin_id", "item", name="uq_checkin_checklist_items_checkin_item"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    checkin_id: Mapped[int] = mapped_column(ForeignKey("checkins.id"), nullable=False)
    item: Mapped[str] = mapped_column(String(20), nullable=False)
    condition: Mapped[str] = mapped_column(String(10), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)


class CheckinPhotoModel(Base):
    __tablename__ = "checkin_photos"
    __table_args__ = (Index("ix_checkin_photos_checkin_id", "checkin_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    checkin_id: Mapped[int] = mapped_column(ForeignKey("checkins.id"), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    # NULL = presign emitido, upload ainda não confirmado.
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

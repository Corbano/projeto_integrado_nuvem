from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base, SoftDeleteMixin, TimestampMixin


class VehicleModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    # Índice NÃO único (reuso após exclusão); a unicidade vive em `active_plate`.
    plate: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    # Igual a `plate` enquanto ativo; NULL após exclusão lógica (NULLs não colidem).
    active_plate: Mapped[str | None] = mapped_column(
        String(7), nullable=True, unique=True, index=True
    )
    brand: Mapped[str] = mapped_column(String(60), nullable=False)
    model: Mapped[str] = mapped_column(String(60), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    engine: Mapped[str | None] = mapped_column(String(60), nullable=True)
    fuel: Mapped[str] = mapped_column(String(16), nullable=False)
    color: Mapped[str] = mapped_column(String(40), nullable=False)
    chassis: Mapped[str | None] = mapped_column(String(17), nullable=True)
    # Igual a `chassis` enquanto ativo e informado; NULL caso contrário.
    active_chassis: Mapped[str | None] = mapped_column(
        String(17), nullable=True, unique=True, index=True
    )
    renavam: Mapped[str | None] = mapped_column(String(11), nullable=True)
    current_km: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base, SoftDeleteMixin, TimestampMixin


class CustomerModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    # Índice NÃO único (reuso após exclusão); a unicidade vive em `active_document`.
    document: Mapped[str] = mapped_column(String(14), nullable=False, index=True)
    # Igual a `document` enquanto ativo; NULL após exclusão lógica. O índice único aqui
    # garante no banco a unicidade entre não excluídos (NULLs não colidem).
    active_document: Mapped[str | None] = mapped_column(String(14), nullable=True, unique=True)
    phone: Mapped[str | None] = mapped_column(String(11), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

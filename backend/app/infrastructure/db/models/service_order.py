from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base, SoftDeleteMixin, TimestampMixin


class ServiceOrderModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "service_orders"
    __table_args__ = (
        CheckConstraint("labor_cost >= 0", name="ck_service_orders_labor_cost"),
        CheckConstraint("total >= 0", name="ck_service_orders_total"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # `OS-000123`, derivado do id dentro da transação do INSERT; único (nunca reutilizado).
    number: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    checkin_id: Mapped[int | None] = mapped_column(ForeignKey("checkins.id"), nullable=True)
    mechanic_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    reported_issue: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    labor_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class ServiceOrderItemModel(Base):
    __tablename__ = "service_order_items"
    __table_args__ = (
        CheckConstraint("qty > 0", name="ck_service_order_items_qty"),
        CheckConstraint("unit_price >= 0", name="ck_service_order_items_unit_price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_order_id: Mapped[int] = mapped_column(
        ForeignKey("service_orders.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    rule_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class ServiceOrderStatusHistoryModel(Base):
    __tablename__ = "service_order_status_history"
    __table_args__ = (
        Index("ix_service_order_status_history_order_id", "service_order_id", "changed_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_order_id: Mapped[int] = mapped_column(ForeignKey("service_orders.id"), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(24), nullable=True)
    to_status: Mapped[str] = mapped_column(String(24), nullable=False)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

"""DTOs de ordens de serviço.

Dinheiro e quantidades trafegam como **strings decimais fixas** no JSON de saída
(`"59.99"` com 2 casas; `qty` com 3 casas, ex. `"1.500"`), sem perda de precisão. Na entrada
aceita-se número ou string, com no máximo 2 casas (3 em `qty`) e limites de valor; mais casas
ou valores negativos/absurdos dão 422.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

from app.domain.service_order import (
    RULE_CODE_PATTERN,
    ItemKind,
    OrderStatus,
    ServiceOrder,
    ServiceOrderItem,
    ServiceOrderRow,
    ServiceOrderStats,
    StatusChange,
)

Money = Annotated[Decimal, PlainSerializer(lambda v: f"{v:.2f}", return_type=str)]
Quantity = Annotated[Decimal, PlainSerializer(lambda v: f"{v:.3f}", return_type=str)]


def _money_field(**kwargs):
    return Field(max_digits=10, decimal_places=2, ge=0, le=Decimal("999999.99"), **kwargs)


def _required_text(value: str | None) -> str:
    if value is None:
        raise ValueError("Campo não pode ser nulo")
    value = value.strip()
    if not value:
        raise ValueError("Campo não pode ser vazio")
    return value


def _optional_text(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


class ServiceOrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_id: int = Field(ge=1)
    checkin_id: int | None = Field(default=None, ge=1)
    mechanic_id: int | None = Field(default=None, ge=1)
    reported_issue: str = Field(max_length=4000)
    labor_cost: Annotated[Decimal, _money_field()] = Decimal("0.00")
    due_date: date | None = None

    @field_validator("reported_issue")
    @classmethod
    def _v_issue(cls, value: str) -> str:
        return _required_text(value)


class ServiceOrderUpdate(BaseModel):
    """PATCH: campos ausentes não mudam; `null` limpa `diagnosis`, `mechanic_id`, `due_date`."""

    model_config = ConfigDict(extra="forbid")

    reported_issue: str | None = Field(default=None, max_length=4000)
    diagnosis: str | None = Field(default=None, max_length=4000)
    labor_cost: Annotated[Decimal | None, _money_field()] = None
    due_date: date | None = None
    mechanic_id: int | None = Field(default=None, ge=1)

    @field_validator("reported_issue", "labor_cost")
    @classmethod
    def _not_null(cls, value):
        if value is None:
            raise ValueError("Campo não pode ser nulo")
        return value

    @field_validator("reported_issue")
    @classmethod
    def _v_issue(cls, value: str) -> str:
        return _required_text(value)

    @field_validator("diagnosis")
    @classmethod
    def _v_diagnosis(cls, value: str | None) -> str | None:
        return _optional_text(value)


class StatusChangeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    to: OrderStatus


class _ItemFields(BaseModel):
    @field_validator("description", check_fields=False)
    @classmethod
    def _v_description(cls, value: str | None) -> str:
        return _required_text(value)

    @field_validator("rule_code", check_fields=False)
    @classmethod
    def _v_rule_code(cls, value: str | None) -> str | None:
        return value or None


class ServiceOrderItemCreate(_ItemFields):
    model_config = ConfigDict(extra="forbid")

    kind: ItemKind
    description: str = Field(max_length=200)
    qty: Decimal = Field(max_digits=10, decimal_places=3, gt=0, le=Decimal("9999.999"))
    unit_price: Annotated[Decimal, _money_field()]
    rule_code: str | None = Field(default=None, max_length=40, pattern=RULE_CODE_PATTERN)


class ServiceOrderItemUpdate(_ItemFields):
    model_config = ConfigDict(extra="forbid")

    kind: ItemKind | None = None
    description: str | None = Field(default=None, max_length=200)
    qty: Decimal | None = Field(
        default=None, max_digits=10, decimal_places=3, gt=0, le=Decimal("9999.999")
    )
    unit_price: Annotated[Decimal | None, _money_field()] = None
    rule_code: str | None = Field(default=None, max_length=40, pattern=RULE_CODE_PATTERN)

    @field_validator("kind", "description", "qty", "unit_price")
    @classmethod
    def _not_null(cls, value):
        if value is None:
            raise ValueError("Campo não pode ser nulo")
        return value


class ServiceOrderItemOut(BaseModel):
    id: int
    kind: ItemKind
    description: str
    qty: Quantity
    unit_price: Money
    line_total: Money
    rule_code: str | None

    @classmethod
    def from_entity(cls, item: ServiceOrderItem) -> "ServiceOrderItemOut":
        return cls(
            id=item.id,
            kind=item.kind,
            description=item.description,
            qty=item.qty,
            unit_price=item.unit_price,
            line_total=item.line_total,
            rule_code=item.rule_code,
        )


class StatusChangeOut(BaseModel):
    from_status: OrderStatus | None
    to_status: OrderStatus
    changed_by_id: int | None
    changed_at: datetime | None

    @classmethod
    def from_entity(cls, change: StatusChange) -> "StatusChangeOut":
        return cls(
            from_status=change.from_status,
            to_status=change.to_status,
            changed_by_id=change.changed_by_id,
            changed_at=change.changed_at,
        )


class ServiceOrderOut(BaseModel):
    id: int
    number: str
    vehicle_id: int
    checkin_id: int | None
    mechanic_id: int | None
    reported_issue: str
    diagnosis: str | None
    labor_cost: Money
    total: Money
    due_date: date | None
    status: OrderStatus
    created_at: datetime | None
    updated_at: datetime | None

    @classmethod
    def from_entity(cls, order: ServiceOrder) -> "ServiceOrderOut":
        return cls(**_fields(order))


class VehicleSummary(BaseModel):
    id: int
    plate: str
    brand: str
    model: str


class CustomerSummary(BaseModel):
    id: int
    name: str


class MechanicSummary(BaseModel):
    id: int
    name: str


class ServiceOrderListOut(ServiceOrderOut):
    """Linha de listagem/histórico: já traz veículo e cliente (sem chamadas extras)."""

    vehicle: VehicleSummary
    customer: CustomerSummary

    @classmethod
    def from_row(cls, row: ServiceOrderRow) -> "ServiceOrderListOut":
        return cls(
            **_fields(row.order),
            vehicle=VehicleSummary(
                id=row.order.vehicle_id,
                plate=row.vehicle_plate,
                brand=row.vehicle_brand,
                model=row.vehicle_model,
            ),
            customer=CustomerSummary(id=row.customer_id, name=row.customer_name),
        )


class _StatsOut(BaseModel):
    service_orders_count: int
    open_orders_count: int
    total_billed: Money
    last_service_date: date | None
    last_order_number: str | None


class CustomerSummaryStatsOut(_StatsOut):
    customer_id: int
    vehicles_count: int

    @classmethod
    def from_stats(cls, customer_id: int, stats: ServiceOrderStats) -> "CustomerSummaryStatsOut":
        return cls(customer_id=customer_id, **_stats_fields(stats), vehicles_count=stats.vehicles_count)


class VehicleSummaryStatsOut(_StatsOut):
    vehicle_id: int

    @classmethod
    def from_stats(cls, vehicle_id: int, stats: ServiceOrderStats) -> "VehicleSummaryStatsOut":
        return cls(vehicle_id=vehicle_id, **_stats_fields(stats))


def _stats_fields(stats: ServiceOrderStats) -> dict:
    return {
        "service_orders_count": stats.service_orders_count,
        "open_orders_count": stats.open_orders_count,
        "total_billed": stats.total_billed,
        "last_service_date": stats.last_service_date,
        "last_order_number": stats.last_order_number,
    }


class ServiceOrderDetailOut(ServiceOrderOut):
    items: list[ServiceOrderItemOut]
    history: list[StatusChangeOut]
    vehicle: VehicleSummary | None
    customer: CustomerSummary | None
    mechanic: MechanicSummary | None

    @classmethod
    def from_entity(  # type: ignore[override]
        cls,
        order: ServiceOrder,
        vehicle: VehicleSummary | None = None,
        customer: CustomerSummary | None = None,
        mechanic: MechanicSummary | None = None,
    ) -> "ServiceOrderDetailOut":
        return cls(
            **_fields(order),
            items=[ServiceOrderItemOut.from_entity(i) for i in order.items],
            history=[StatusChangeOut.from_entity(h) for h in order.history],
            vehicle=vehicle,
            customer=customer,
            mechanic=mechanic,
        )


def _fields(order: ServiceOrder) -> dict:
    return {
        "id": order.id,
        "number": order.number,
        "vehicle_id": order.vehicle_id,
        "checkin_id": order.checkin_id,
        "mechanic_id": order.mechanic_id,
        "reported_issue": order.reported_issue,
        "diagnosis": order.diagnosis,
        "labor_cost": order.labor_cost,
        "total": order.total,
        "due_date": order.due_date,
        "status": order.status,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
    }

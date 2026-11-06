"""Ordem de serviço: máquina de estados, permissões por transição, cálculo do total e portas."""

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from typing import Protocol

from app.domain.errors import BusinessRuleError
from app.domain.roles import Role

CENT = Decimal("0.01")
MAX_TOTAL = Decimal("99999999.99")  # limite de Numeric(10, 2)
MAX_ITEMS = 200
RULE_CODE_PATTERN = r"^[a-z0-9_]{1,40}$"
_RULE_CODE = re.compile(RULE_CODE_PATTERN)


class OrderStatus(StrEnum):
    OPEN = "aberta"
    AWAITING_QUOTE = "aguardando_orcamento"
    AWAITING_APPROVAL = "aguardando_aprovacao"
    IN_PROGRESS = "em_execucao"
    FINISHED = "finalizada"
    DELIVERED = "entregue"


class ItemKind(StrEnum):
    SERVICE = "service"
    PART = "part"


S = OrderStatus

# Transições válidas (fluxo linear + retorno de orçamento recusado/ajustado).
TRANSITIONS: dict[OrderStatus, tuple[OrderStatus, ...]] = {
    S.OPEN: (S.AWAITING_QUOTE,),
    S.AWAITING_QUOTE: (S.AWAITING_APPROVAL,),
    S.AWAITING_APPROVAL: (S.IN_PROGRESS, S.AWAITING_QUOTE),
    S.IN_PROGRESS: (S.FINISHED,),
    S.FINISHED: (S.DELIVERED,),
    S.DELIVERED: (),
}

_FRONT_DESK = frozenset({Role.ADMIN, Role.RECEPTION})

# Quem pode executar cada transição. O mecânico só finaliza, e só na OS atribuída a ele
# (a atribuição é verificada pelo service; aqui vale o perfil). A recepção não finaliza.
TRANSITION_ROLES: dict[tuple[OrderStatus, OrderStatus], frozenset[Role]] = {
    (S.OPEN, S.AWAITING_QUOTE): _FRONT_DESK,
    (S.AWAITING_QUOTE, S.AWAITING_APPROVAL): _FRONT_DESK,
    (S.AWAITING_APPROVAL, S.IN_PROGRESS): _FRONT_DESK,
    (S.AWAITING_APPROVAL, S.AWAITING_QUOTE): _FRONT_DESK,
    (S.IN_PROGRESS, S.FINISHED): frozenset({Role.ADMIN, Role.MECHANIC}),
    (S.FINISHED, S.DELIVERED): _FRONT_DESK,
}

ITEM_EDIT_BLOCKED = frozenset({S.FINISHED, S.DELIVERED})


def allowed_transitions(current: OrderStatus) -> tuple[OrderStatus, ...]:
    return TRANSITIONS[current]


def validate_transition(current: OrderStatus, target: OrderStatus) -> None:
    if target not in TRANSITIONS[current]:
        allowed = ", ".join(s.value for s in TRANSITIONS[current]) or "nenhuma"
        raise BusinessRuleError(
            f"Transição inválida: {current.value} -> {target.value}. Permitidas: {allowed}"
        )


def can_transition(role: Role, current: OrderStatus, target: OrderStatus) -> bool:
    return role in TRANSITION_ROLES.get((current, target), frozenset())


def is_valid_rule_code(value: str) -> bool:
    return _RULE_CODE.fullmatch(value) is not None


def money(value: Decimal) -> Decimal:
    """Arredonda para 2 casas, metade para cima."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def line_total(qty: Decimal, unit_price: Decimal) -> Decimal:
    return money(qty * unit_price)


def compute_total(labor_cost: Decimal, lines: list[tuple[Decimal, Decimal]]) -> Decimal:
    """`labor_cost + Σ(qty × unit_price)`, cada linha arredondada a 2 casas (como na nota)."""
    total = money(labor_cost) + sum((line_total(q, p) for q, p in lines), Decimal("0.00"))
    if total > MAX_TOTAL:
        raise BusinessRuleError("O total da ordem de serviço excede o limite permitido")
    return total


@dataclass
class ServiceOrderItem:
    id: int | None
    service_order_id: int
    kind: ItemKind
    description: str
    qty: Decimal
    unit_price: Decimal
    rule_code: str | None = None
    created_at: datetime | None = None

    @property
    def line_total(self) -> Decimal:
        return line_total(self.qty, self.unit_price)


@dataclass
class StatusChange:
    id: int | None
    service_order_id: int
    from_status: OrderStatus | None
    to_status: OrderStatus
    changed_by_id: int | None
    changed_at: datetime | None = None


@dataclass
class ServiceOrder:
    id: int | None
    number: str | None
    vehicle_id: int
    reported_issue: str
    status: OrderStatus = OrderStatus.OPEN
    checkin_id: int | None = None
    mechanic_id: int | None = None
    diagnosis: str | None = None
    labor_cost: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    due_date: date | None = None
    created_by_id: int | None = None
    updated_by_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    items: list[ServiceOrderItem] = field(default_factory=list)
    history: list[StatusChange] = field(default_factory=list)


def format_number(order_id: int) -> str:
    return f"OS-{order_id:06d}"


class ServiceOrderRepository(Protocol):
    """Nenhum método confirma a transação: o service chama `uow.commit()`."""

    def add(self, order: ServiceOrder) -> ServiceOrder:
        """Insere, gera o `number` sequencial e devolve a OS."""
        ...

    def get_by_id(self, order_id: int, *, for_update: bool = False) -> ServiceOrder | None:
        """Com itens e histórico; ignora excluídas."""
        ...

    def update(self, order: ServiceOrder) -> None: ...

    def soft_delete(self, order_id: int, *, actor_id: int) -> None: ...

    def add_history(self, change: StatusChange) -> None: ...

    def add_item(self, item: ServiceOrderItem) -> ServiceOrderItem: ...

    def get_item(self, order_id: int, item_id: int) -> ServiceOrderItem | None: ...

    def update_item(self, item: ServiceOrderItem) -> None: ...

    def delete_item(self, item_id: int) -> None: ...

    def list_items(self, order_id: int) -> list[ServiceOrderItem]: ...

    def list_page(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None,
        status: OrderStatus | None = None,
        vehicle_id: int | None = None,
        mechanic_id: int | None = None,
    ) -> tuple[list[ServiceOrder], int]:
        """Busca por número, placa do veículo e nome do cliente; mais recentes primeiro."""
        ...

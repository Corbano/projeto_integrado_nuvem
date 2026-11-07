from app.application.dtos.common import Page
from app.application.dtos.service_order import (
    CustomerSummary,
    CustomerSummaryStatsOut,
    MechanicSummary,
    ServiceOrderCreate,
    ServiceOrderDetailOut,
    ServiceOrderItemCreate,
    ServiceOrderItemUpdate,
    ServiceOrderListOut,
    ServiceOrderUpdate,
    VehicleSummary,
    VehicleSummaryStatsOut,
)
from app.application.ports import UnitOfWork
from app.domain.checkin import CheckinRepository
from app.domain.customer import CustomerRepository
from app.domain.errors import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.domain.roles import Role
from app.domain.service_order import (
    ITEM_EDIT_BLOCKED,
    MAX_ITEMS,
    OrderStatus,
    ServiceOrder,
    ServiceOrderItem,
    ServiceOrderRepository,
    StatusChange,
    can_transition,
    compute_total,
    validate_transition,
)
from app.domain.user import User, UserRepository
from app.domain.vehicle import VehicleRepository

_NO_ACCESS = -1  # id inexistente: lista vazia
_NOT_FOUND = "Ordem de serviço não encontrada"
_ITEMS_LOCKED = "Itens não podem ser alterados em ordens finalizadas ou entregues"
_FRONT_DESK = (Role.ADMIN, Role.RECEPTION)
# Campos do PATCH que o mecânico (da própria OS) pode alterar.
_MECHANIC_FIELDS = {"diagnosis"}


class ServiceOrderService:
    def __init__(
        self,
        orders: ServiceOrderRepository,
        vehicles: VehicleRepository,
        customers: CustomerRepository,
        checkins: CheckinRepository,
        users: UserRepository,
        uow: UnitOfWork,
    ) -> None:
        self._orders = orders
        self._vehicles = vehicles
        self._customers = customers
        self._checkins = checkins
        self._users = users
        self._uow = uow

    # ---- consultas --------------------------------------------------------------------

    def list_orders(
        self,
        *,
        actor: User,
        page: int,
        size: int,
        search: str | None,
        status: OrderStatus | None = None,
        vehicle_id: int | None = None,
        mechanic_id: int | None = None,
        customer_id: int | None = None,
    ) -> Page[ServiceOrderListOut]:
        mechanic_id = self._scope_mechanic(actor, mechanic_id)
        if mechanic_id == _NO_ACCESS:
            return Page[ServiceOrderListOut](items=[], total=0, page=page, size=size)
        rows, total = self._orders.list_page(
            offset=(page - 1) * size,
            limit=size,
            search=search,
            status=status,
            vehicle_id=vehicle_id,
            mechanic_id=mechanic_id,
            customer_id=customer_id,
        )
        return Page[ServiceOrderListOut](
            items=[ServiceOrderListOut.from_row(r) for r in rows],
            total=total,
            page=page,
            size=size,
        )

    def list_for_customer(
        self, customer_id: int, *, actor: User, page: int, size: int
    ) -> Page[ServiceOrderListOut]:
        self._customer_or_404(customer_id)
        return self.list_orders(
            actor=actor, page=page, size=size, search=None, customer_id=customer_id
        )

    def list_for_vehicle(
        self, vehicle_id: int, *, actor: User, page: int, size: int
    ) -> Page[ServiceOrderListOut]:
        self._vehicle_or_404(vehicle_id)
        return self.list_orders(
            actor=actor, page=page, size=size, search=None, vehicle_id=vehicle_id
        )

    def customer_summary(self, customer_id: int, *, actor: User) -> CustomerSummaryStatsOut:
        self._customer_or_404(customer_id)
        stats = self._orders.stats(
            customer_id=customer_id, mechanic_id=self._summary_mechanic(actor)
        )
        return CustomerSummaryStatsOut.from_stats(customer_id, stats)

    def vehicle_summary(self, vehicle_id: int, *, actor: User) -> VehicleSummaryStatsOut:
        self._vehicle_or_404(vehicle_id)
        stats = self._orders.stats(vehicle_id=vehicle_id, mechanic_id=self._summary_mechanic(actor))
        return VehicleSummaryStatsOut.from_stats(vehicle_id, stats)

    def get(self, order_id: int, *, actor: User) -> ServiceOrderDetailOut:
        return self._detail(self._load(order_id, actor))

    # ---- escrita ----------------------------------------------------------------------

    def create(self, data: ServiceOrderCreate, *, actor: User) -> ServiceOrderDetailOut:
        self._require(actor, _FRONT_DESK)
        if self._vehicles.get_by_id(data.vehicle_id) is None:
            raise NotFoundError("Veículo não encontrado")
        if data.checkin_id is not None:
            checkin = self._checkins.get_by_id(data.checkin_id)
            if checkin is None:
                raise NotFoundError("Check-in não encontrado")
            if checkin.vehicle_id != data.vehicle_id:
                raise BusinessRuleError("O check-in pertence a outro veículo")
        if data.mechanic_id is not None:
            self._validate_mechanic(data.mechanic_id)
        total = compute_total(data.labor_cost, [])
        with self._transaction():
            saved = self._orders.add(
                ServiceOrder(
                    id=None,
                    number=None,
                    vehicle_id=data.vehicle_id,
                    checkin_id=data.checkin_id,
                    mechanic_id=data.mechanic_id,
                    reported_issue=data.reported_issue,
                    labor_cost=data.labor_cost,
                    total=total,
                    due_date=data.due_date,
                    status=OrderStatus.OPEN,
                    created_by_id=actor.id,
                    updated_by_id=actor.id,
                )
            )
            self._orders.add_history(
                StatusChange(
                    id=None,
                    service_order_id=saved.id,
                    from_status=None,
                    to_status=OrderStatus.OPEN,
                    changed_by_id=actor.id,
                )
            )
        return self._detail(self._orders.get_by_id(saved.id))

    def update(
        self, order_id: int, data: ServiceOrderUpdate, *, actor: User
    ) -> ServiceOrderDetailOut:
        order = self._load(order_id, actor, for_update=True)
        changes = data.model_dump(exclude_unset=True)
        if actor.role is Role.MECHANIC and not set(changes) <= _MECHANIC_FIELDS:
            raise PermissionDeniedError("O mecânico só pode editar o diagnóstico")
        if order.status is OrderStatus.DELIVERED:
            raise BusinessRuleError("Ordens entregues não podem ser alteradas")
        if order.status is OrderStatus.FINISHED and (
            changes.keys() - {"diagnosis", "due_date"}
        ):
            raise BusinessRuleError(
                "Ordens finalizadas só permitem alterar diagnóstico e prazo"
            )
        if changes.get("mechanic_id") is not None:
            self._validate_mechanic(changes["mechanic_id"])
        for field, value in changes.items():
            setattr(order, field, value)
        order.updated_by_id = actor.id
        with self._transaction():
            if "labor_cost" in changes:
                self._recalculate(order)
            self._orders.update(order)
        return self._detail(self._orders.get_by_id(order_id))

    def change_status(
        self, order_id: int, target: OrderStatus, *, actor: User
    ) -> ServiceOrderDetailOut:
        order = self._load(order_id, actor, for_update=True)
        validate_transition(order.status, target)
        if not can_transition(actor.role, order.status, target):
            raise PermissionDeniedError(
                "Seu perfil não pode executar a transição "
                f"{order.status.value} -> {target.value}"
            )
        with self._transaction():
            self._orders.add_history(
                StatusChange(
                    id=None,
                    service_order_id=order_id,
                    from_status=order.status,
                    to_status=target,
                    changed_by_id=actor.id,
                )
            )
            order.status = target
            order.updated_by_id = actor.id
            self._orders.update(order)
        return self._detail(self._orders.get_by_id(order_id))

    def delete(self, order_id: int, *, actor: User) -> None:
        self._require(actor, (Role.ADMIN,))
        order = self._load(order_id, actor, for_update=True)
        if order.status is not OrderStatus.OPEN:
            raise BusinessRuleError("Só é possível excluir ordens com status aberta")
        with self._transaction():
            self._orders.soft_delete(order_id, actor_id=actor.id)

    # ---- itens ------------------------------------------------------------------------

    def add_item(
        self, order_id: int, data: ServiceOrderItemCreate, *, actor: User
    ) -> ServiceOrderDetailOut:
        order = self._editable_items_order(order_id, actor)
        if len(order.items) >= MAX_ITEMS:
            raise BusinessRuleError(f"Limite de {MAX_ITEMS} itens por ordem de serviço")
        with self._transaction():
            self._orders.add_item(
                ServiceOrderItem(
                    id=None,
                    service_order_id=order_id,
                    kind=data.kind,
                    description=data.description,
                    qty=data.qty,
                    unit_price=data.unit_price,
                    rule_code=data.rule_code,
                )
            )
            self._touch_and_recalculate(order, actor)
        return self._detail(self._orders.get_by_id(order_id))

    def update_item(
        self, order_id: int, item_id: int, data: ServiceOrderItemUpdate, *, actor: User
    ) -> ServiceOrderDetailOut:
        order = self._editable_items_order(order_id, actor)
        item = self._orders.get_item(order_id, item_id)
        if item is None:
            raise NotFoundError("Item não encontrado")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        with self._transaction():
            self._orders.update_item(item)
            self._touch_and_recalculate(order, actor)
        return self._detail(self._orders.get_by_id(order_id))

    def delete_item(self, order_id: int, item_id: int, *, actor: User) -> None:
        order = self._editable_items_order(order_id, actor)
        if self._orders.get_item(order_id, item_id) is None:
            raise NotFoundError("Item não encontrado")
        with self._transaction():
            self._orders.delete_item(item_id)
            self._touch_and_recalculate(order, actor)

    # ---- internos ---------------------------------------------------------------------

    @staticmethod
    def _scope_mechanic(actor: User, mechanic_id: int | None) -> int | None:
        """Mecânico só enxerga as OS atribuídas a ele; `_NO_ACCESS` = pediu outro mecânico."""
        if actor.role is not Role.MECHANIC:
            return mechanic_id
        return actor.id if mechanic_id in (None, actor.id) else _NO_ACCESS

    @staticmethod
    def _summary_mechanic(actor: User) -> int | None:
        return actor.id if actor.role is Role.MECHANIC else None

    def _customer_or_404(self, customer_id: int) -> None:
        if self._customers.get_by_id(customer_id) is None:
            raise NotFoundError("Cliente não encontrado")

    def _vehicle_or_404(self, vehicle_id: int) -> None:
        if self._vehicles.get_by_id(vehicle_id) is None:
            raise NotFoundError("Veículo não encontrado")

    def _transaction(self):
        return _Transaction(self._uow)

    @staticmethod
    def _require(actor: User, roles: tuple[Role, ...]) -> None:
        if actor.role not in roles:
            raise PermissionDeniedError("Acesso negado para este perfil")

    def _load(self, order_id: int, actor: User, *, for_update: bool = False) -> ServiceOrder:
        order = self._orders.get_by_id(order_id, for_update=for_update)
        if order is None:
            raise NotFoundError(_NOT_FOUND)
        if actor.role is Role.MECHANIC and order.mechanic_id != actor.id:
            # 404 (e não 403) para não revelar que a OS existe.
            raise NotFoundError(_NOT_FOUND)
        return order

    def _editable_items_order(self, order_id: int, actor: User) -> ServiceOrder:
        order = self._load(order_id, actor, for_update=True)
        if order.status in ITEM_EDIT_BLOCKED:
            raise BusinessRuleError(_ITEMS_LOCKED)
        return order

    def _validate_mechanic(self, mechanic_id: int) -> None:
        user = self._users.get_by_id(mechanic_id)
        if user is None or not user.active or user.role is not Role.MECHANIC:
            raise BusinessRuleError(
                "O mecânico informado deve ser um usuário ativo com perfil mecânico"
            )

    def _recalculate(self, order: ServiceOrder) -> None:
        items = self._orders.list_items(order.id)
        order.total = compute_total(order.labor_cost, [(i.qty, i.unit_price) for i in items])

    def _touch_and_recalculate(self, order: ServiceOrder, actor: User) -> None:
        order.updated_by_id = actor.id
        self._recalculate(order)
        self._orders.update(order)

    def _detail(self, order: ServiceOrder) -> ServiceOrderDetailOut:
        vehicle = self._vehicles.get_by_id(order.vehicle_id)
        customer = self._customers.get_by_id(vehicle.customer_id) if vehicle else None
        mechanic = self._users.get_by_id(order.mechanic_id) if order.mechanic_id else None
        return ServiceOrderDetailOut.from_entity(
            order,
            VehicleSummary(
                id=vehicle.id, plate=vehicle.plate, brand=vehicle.brand, model=vehicle.model
            )
            if vehicle
            else None,
            CustomerSummary(id=customer.id, name=customer.name) if customer else None,
            MechanicSummary(id=mechanic.id, name=mechanic.name) if mechanic else None,
        )


class _Transaction:
    """Confirma ao sair sem erro; desfaz em qualquer exceção."""

    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is None:
            self._uow.commit()
        else:
            self._uow.rollback()
        return False


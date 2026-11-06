import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.errors import ConflictError, NotFoundError
from app.domain.service_order import (
    ItemKind,
    OrderStatus,
    ServiceOrder,
    ServiceOrderItem,
    StatusChange,
    format_number,
)
from app.infrastructure.db.models.customer import CustomerModel
from app.infrastructure.db.models.service_order import (
    ServiceOrderItemModel,
    ServiceOrderModel,
    ServiceOrderStatusHistoryModel,
)
from app.infrastructure.db.models.vehicle import VehicleModel


def _escape(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _item_to_entity(model: ServiceOrderItemModel) -> ServiceOrderItem:
    return ServiceOrderItem(
        id=model.id,
        service_order_id=model.service_order_id,
        kind=ItemKind(model.kind),
        description=model.description,
        qty=model.qty,
        unit_price=model.unit_price,
        rule_code=model.rule_code,
        created_at=model.created_at,
    )


def _history_to_entity(model: ServiceOrderStatusHistoryModel) -> StatusChange:
    return StatusChange(
        id=model.id,
        service_order_id=model.service_order_id,
        from_status=OrderStatus(model.from_status) if model.from_status else None,
        to_status=OrderStatus(model.to_status),
        changed_by_id=model.changed_by_id,
        changed_at=model.changed_at,
    )


class SqlServiceOrderRepository:
    """Nunca confirma a transação (só `flush`): o service chama `uow.commit()`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(
        model: ServiceOrderModel,
        items: list[ServiceOrderItemModel] | None = None,
        history: list[ServiceOrderStatusHistoryModel] | None = None,
    ) -> ServiceOrder:
        return ServiceOrder(
            id=model.id,
            number=model.number,
            vehicle_id=model.vehicle_id,
            checkin_id=model.checkin_id,
            mechanic_id=model.mechanic_id,
            reported_issue=model.reported_issue,
            diagnosis=model.diagnosis,
            labor_cost=model.labor_cost,
            total=model.total,
            due_date=model.due_date,
            status=OrderStatus(model.status),
            created_by_id=model.created_by_id,
            updated_by_id=model.updated_by_id,
            created_at=model.created_at,
            updated_at=model.updated_at,
            items=[_item_to_entity(i) for i in items or []],
            history=[_history_to_entity(h) for h in history or []],
        )

    def _alive_model(self, order_id: int, *, for_update: bool = False) -> ServiceOrderModel | None:
        stmt = select(ServiceOrderModel).where(
            ServiceOrderModel.id == order_id, ServiceOrderModel.deleted_at.is_(None)
        )
        if for_update:
            stmt = stmt.with_for_update()
        return self._db.scalar(stmt)

    def add(self, order: ServiceOrder) -> ServiceOrder:
        # O número vem do id (autoincremento do banco => sem colisão entre transações
        # concorrentes). Um valor provisório único ocupa a coluna só até o flush do id.
        model = ServiceOrderModel(
            number=f"TMP-{uuid.uuid4().hex}",
            vehicle_id=order.vehicle_id,
            checkin_id=order.checkin_id,
            mechanic_id=order.mechanic_id,
            reported_issue=order.reported_issue,
            diagnosis=order.diagnosis,
            labor_cost=order.labor_cost,
            total=order.total,
            due_date=order.due_date,
            status=order.status.value,
            created_by_id=order.created_by_id,
            updated_by_id=order.updated_by_id,
        )
        try:
            self._db.add(model)
            self._db.flush()
            model.number = format_number(model.id)
            self._db.flush()
        except IntegrityError:
            self._db.rollback()
            raise ConflictError("Conflito ao salvar a ordem de serviço") from None
        self._db.refresh(model)
        return self._to_entity(model)

    def get_by_id(self, order_id: int, *, for_update: bool = False) -> ServiceOrder | None:
        model = self._alive_model(order_id, for_update=for_update)
        if model is None:
            return None
        items = self._db.scalars(
            select(ServiceOrderItemModel)
            .where(ServiceOrderItemModel.service_order_id == order_id)
            .order_by(ServiceOrderItemModel.id)
        ).all()
        history = self._db.scalars(
            select(ServiceOrderStatusHistoryModel)
            .where(ServiceOrderStatusHistoryModel.service_order_id == order_id)
            .order_by(ServiceOrderStatusHistoryModel.id)
        ).all()
        return self._to_entity(model, list(items), list(history))

    def update(self, order: ServiceOrder) -> None:
        model = self._alive_model(order.id)
        if model is None:
            raise NotFoundError("Ordem de serviço não encontrada")
        model.mechanic_id = order.mechanic_id
        model.reported_issue = order.reported_issue
        model.diagnosis = order.diagnosis
        model.labor_cost = order.labor_cost
        model.total = order.total
        model.due_date = order.due_date
        model.status = order.status.value
        model.updated_by_id = order.updated_by_id
        self._db.flush()

    def soft_delete(self, order_id: int, *, actor_id: int) -> None:
        model = self._alive_model(order_id)
        if model is None:
            raise NotFoundError("Ordem de serviço não encontrada")
        model.updated_by_id = actor_id
        model.deleted_at = datetime.now(UTC).replace(tzinfo=None)
        self._db.flush()

    def add_history(self, change: StatusChange) -> None:
        self._db.add(
            ServiceOrderStatusHistoryModel(
                service_order_id=change.service_order_id,
                from_status=change.from_status.value if change.from_status else None,
                to_status=change.to_status.value,
                changed_by_id=change.changed_by_id,
            )
        )
        self._db.flush()

    def add_item(self, item: ServiceOrderItem) -> ServiceOrderItem:
        model = ServiceOrderItemModel(
            service_order_id=item.service_order_id,
            kind=item.kind.value,
            description=item.description,
            qty=item.qty,
            unit_price=item.unit_price,
            rule_code=item.rule_code,
        )
        self._db.add(model)
        self._db.flush()
        self._db.refresh(model)
        return _item_to_entity(model)

    def _item_model(self, order_id: int, item_id: int) -> ServiceOrderItemModel | None:
        return self._db.scalar(
            select(ServiceOrderItemModel).where(
                ServiceOrderItemModel.id == item_id,
                ServiceOrderItemModel.service_order_id == order_id,
            )
        )

    def get_item(self, order_id: int, item_id: int) -> ServiceOrderItem | None:
        model = self._item_model(order_id, item_id)
        return _item_to_entity(model) if model else None

    def update_item(self, item: ServiceOrderItem) -> None:
        model = self._item_model(item.service_order_id, item.id)
        if model is None:
            raise NotFoundError("Item não encontrado")
        model.kind = item.kind.value
        model.description = item.description
        model.qty = item.qty
        model.unit_price = item.unit_price
        model.rule_code = item.rule_code
        self._db.flush()

    def delete_item(self, item_id: int) -> None:
        model = self._db.get(ServiceOrderItemModel, item_id)
        if model is not None:
            self._db.delete(model)
            self._db.flush()

    def list_items(self, order_id: int) -> list[ServiceOrderItem]:
        rows = self._db.scalars(
            select(ServiceOrderItemModel)
            .where(ServiceOrderItemModel.service_order_id == order_id)
            .order_by(ServiceOrderItemModel.id)
        ).all()
        return [_item_to_entity(r) for r in rows]

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
        stmt = select(ServiceOrderModel).where(ServiceOrderModel.deleted_at.is_(None))
        if status is not None:
            stmt = stmt.where(ServiceOrderModel.status == status.value)
        if vehicle_id is not None:
            stmt = stmt.where(ServiceOrderModel.vehicle_id == vehicle_id)
        if mechanic_id is not None:
            stmt = stmt.where(ServiceOrderModel.mechanic_id == mechanic_id)
        if search and search.strip():
            like = f"%{_escape(search.strip())}%"
            matching_vehicles = (
                select(VehicleModel.id)
                .join(CustomerModel, CustomerModel.id == VehicleModel.customer_id)
                .where(
                    or_(
                        VehicleModel.plate.ilike(like, escape="\\"),
                        CustomerModel.name.ilike(like, escape="\\"),
                    )
                )
            )
            stmt = stmt.where(
                or_(
                    ServiceOrderModel.number.ilike(like, escape="\\"),
                    ServiceOrderModel.vehicle_id.in_(matching_vehicles),
                )
            )
        total = self._db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self._db.scalars(
            stmt.order_by(ServiceOrderModel.id.desc()).offset(offset).limit(limit)
        ).all()
        return [self._to_entity(r) for r in rows], total

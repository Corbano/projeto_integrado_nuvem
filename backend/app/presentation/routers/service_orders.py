from fastapi import APIRouter, Depends, Query, Response, status

from app.application.dtos.common import Page
from app.application.dtos.service_order import (
    ServiceOrderCreate,
    ServiceOrderDetailOut,
    ServiceOrderItemCreate,
    ServiceOrderItemUpdate,
    ServiceOrderListOut,
    ServiceOrderOut,
    ServiceOrderUpdate,
    StatusChangeIn,
)
from app.application.services.service_order_service import ServiceOrderService
from app.domain.roles import Role
from app.domain.service_order import OrderStatus
from app.domain.user import User
from app.presentation.deps import get_current_user, get_service_order_service, require_roles

require_front_desk = require_roles(Role.ADMIN, Role.RECEPTION)
require_admin = require_roles(Role.ADMIN)

# Autorização fina (por transição, por campo e por atribuição do mecânico) fica no service.
router = APIRouter(
    prefix="/service-orders",
    tags=["service-orders"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=Page[ServiceOrderListOut])
def list_orders(
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    status_filter: OrderStatus | None = Query(None, alias="status"),
    vehicle_id: int | None = Query(None, ge=1),
    mechanic_id: int | None = Query(None, ge=1),
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.list_orders(
        actor=actor,
        page=page,
        size=size,
        search=q,
        status=status_filter,
        vehicle_id=vehicle_id,
        mechanic_id=mechanic_id,
    )


@router.post("", response_model=ServiceOrderDetailOut, status_code=status.HTTP_201_CREATED)
def create_order(
    body: ServiceOrderCreate,
    actor: User = Depends(require_front_desk),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.create(body, actor=actor)


@router.get("/{order_id}", response_model=ServiceOrderDetailOut)
def get_order(
    order_id: int,
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.get(order_id, actor=actor)


@router.patch("/{order_id}", response_model=ServiceOrderDetailOut)
def update_order(
    order_id: int,
    body: ServiceOrderUpdate,
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.update(order_id, body, actor=actor)


@router.post("/{order_id}/status", response_model=ServiceOrderDetailOut)
def change_status(
    order_id: int,
    body: StatusChangeIn,
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.change_status(order_id, body.to, actor=actor)


@router.post(
    "/{order_id}/items",
    response_model=ServiceOrderDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def add_item(
    order_id: int,
    body: ServiceOrderItemCreate,
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.add_item(order_id, body, actor=actor)


@router.patch("/{order_id}/items/{item_id}", response_model=ServiceOrderDetailOut)
def update_item(
    order_id: int,
    item_id: int,
    body: ServiceOrderItemUpdate,
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    return service.update_item(order_id, item_id, body, actor=actor)


@router.delete("/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    order_id: int,
    item_id: int,
    actor: User = Depends(get_current_user),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    service.delete_item(order_id, item_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    actor: User = Depends(require_admin),
    service: ServiceOrderService = Depends(get_service_order_service),
):
    service.delete(order_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

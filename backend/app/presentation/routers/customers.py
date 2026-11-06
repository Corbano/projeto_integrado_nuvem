from fastapi import APIRouter, Depends, Query, Response, status

from app.application.dtos.common import Page
from app.application.dtos.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.application.dtos.vehicle import VehicleOut
from app.application.services.customer_service import CustomerService
from app.application.services.vehicle_service import VehicleService
from app.domain.roles import Role
from app.domain.user import User
from app.presentation.deps import (
    get_current_user,
    get_customer_service,
    get_vehicle_service,
    require_roles,
)

require_writer = require_roles(Role.ADMIN, Role.RECEPTION)

# Leitura: qualquer perfil autenticado. Escrita: admin e recepção.
router = APIRouter(
    prefix="/customers",
    tags=["customers"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=Page[CustomerOut])
def list_customers(
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    service: CustomerService = Depends(get_customer_service),
):
    return service.list_customers(page=page, size=size, search=q)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerCreate,
    actor: User = Depends(require_writer),
    service: CustomerService = Depends(get_customer_service),
):
    return service.create(body, actor_id=actor.id)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, service: CustomerService = Depends(get_customer_service)):
    return service.get(customer_id)


@router.get("/{customer_id}/vehicles", response_model=Page[VehicleOut])
def list_customer_vehicles(
    customer_id: int,
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    service: VehicleService = Depends(get_vehicle_service),
):
    return service.list_by_customer(customer_id, page=page, size=size)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    actor: User = Depends(require_writer),
    service: CustomerService = Depends(get_customer_service),
):
    return service.update(customer_id, body, actor_id=actor.id)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    actor: User = Depends(require_writer),
    service: CustomerService = Depends(get_customer_service),
):
    service.delete(customer_id, actor_id=actor.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from fastapi import APIRouter, Depends, Query, Response, status

from app.application.dtos.common import Page
from app.application.dtos.vehicle import (
    VehicleCreate,
    VehicleDetailOut,
    VehicleOut,
    VehicleUpdate,
)
from app.application.services.vehicle_service import VehicleService
from app.domain.roles import Role
from app.domain.user import User
from app.presentation.deps import get_current_user, get_vehicle_service, require_roles

require_writer = require_roles(Role.ADMIN, Role.RECEPTION)

# Leitura: qualquer perfil autenticado. Escrita: admin e recepção.
router = APIRouter(
    prefix="/vehicles",
    tags=["vehicles"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=Page[VehicleOut])
def list_vehicles(
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    customer_id: int | None = Query(None, ge=1),
    service: VehicleService = Depends(get_vehicle_service),
):
    return service.list_vehicles(page=page, size=size, search=q, customer_id=customer_id)


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    body: VehicleCreate,
    actor: User = Depends(require_writer),
    service: VehicleService = Depends(get_vehicle_service),
):
    return service.create(body, actor_id=actor.id)


@router.get("/{vehicle_id}", response_model=VehicleDetailOut)
def get_vehicle(vehicle_id: int, service: VehicleService = Depends(get_vehicle_service)):
    return service.get(vehicle_id)


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    actor: User = Depends(require_writer),
    service: VehicleService = Depends(get_vehicle_service),
):
    return service.update(vehicle_id, body, actor_id=actor.id)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: int,
    actor: User = Depends(require_writer),
    service: VehicleService = Depends(get_vehicle_service),
):
    service.delete(vehicle_id, actor_id=actor.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

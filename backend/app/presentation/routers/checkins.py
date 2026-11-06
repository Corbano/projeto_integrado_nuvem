from fastapi import APIRouter, Depends, Query, Response, status

from app.application.dtos.checkin import (
    CheckinCreate,
    CheckinOut,
    CheckinSummaryOut,
    PhotoOut,
    PhotoPresignIn,
    PhotoPresignOut,
)
from app.application.dtos.common import Page
from app.application.services.checkin_service import CheckinService
from app.domain.roles import Role
from app.domain.user import User
from app.presentation.deps import get_checkin_service, get_current_user, require_roles

require_writer = require_roles(Role.ADMIN, Role.RECEPTION)

# Leitura: qualquer perfil autenticado. Escrita (check-in e fotos): admin e recepção.
router = APIRouter(
    prefix="/checkins",
    tags=["checkins"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=Page[CheckinSummaryOut])
def list_checkins(
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    vehicle_id: int | None = Query(None, ge=1),
    service: CheckinService = Depends(get_checkin_service),
):
    return service.list(page=page, size=size, vehicle_id=vehicle_id)


@router.post("", response_model=CheckinOut, status_code=status.HTTP_201_CREATED)
def create_checkin(
    body: CheckinCreate,
    actor: User = Depends(require_writer),
    service: CheckinService = Depends(get_checkin_service),
):
    return service.create(body, actor)


@router.get("/{checkin_id}", response_model=CheckinOut)
def get_checkin(checkin_id: int, service: CheckinService = Depends(get_checkin_service)):
    return service.get(checkin_id)


@router.post(
    "/{checkin_id}/photos/presign",
    response_model=PhotoPresignOut,
    status_code=status.HTTP_201_CREATED,
)
def presign_photo(
    checkin_id: int,
    body: PhotoPresignIn,
    _: User = Depends(require_writer),
    service: CheckinService = Depends(get_checkin_service),
):
    return service.presign_photo(checkin_id, body)


@router.post("/{checkin_id}/photos/{photo_id}/confirm", response_model=PhotoOut)
def confirm_photo(
    checkin_id: int,
    photo_id: int,
    _: User = Depends(require_writer),
    service: CheckinService = Depends(get_checkin_service),
):
    return service.confirm_photo(checkin_id, photo_id)


@router.delete("/{checkin_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    checkin_id: int,
    photo_id: int,
    _: User = Depends(require_writer),
    service: CheckinService = Depends(get_checkin_service),
):
    service.delete_photo(checkin_id, photo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

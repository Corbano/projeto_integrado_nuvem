from fastapi import APIRouter, Depends, Query, status

from app.application.dtos.common import Page
from app.application.dtos.km import KmReadingOut, KmRegister
from app.application.services.km_service import KmService
from app.domain.km import KmSource
from app.domain.roles import Role
from app.domain.user import User
from app.presentation.deps import get_current_user, get_km_service, require_roles

require_registrar = require_roles(Role.ADMIN, Role.RECEPTION, Role.MECHANIC)

# Leitura: qualquer perfil autenticado. Registro: admin, recepção e mecânico
# (`force` só admin, validado no service).
router = APIRouter(
    prefix="/vehicles",
    tags=["km"],
    dependencies=[Depends(get_current_user)],
)


@router.post(
    "/{vehicle_id}/km", response_model=KmReadingOut, status_code=status.HTTP_201_CREATED
)
def register_km(
    vehicle_id: int,
    body: KmRegister,
    actor: User = Depends(require_registrar),
    service: KmService = Depends(get_km_service),
):
    return service.register(
        vehicle_id, body.km, KmSource.MANUAL, body.note, body.force, actor
    )


@router.get("/{vehicle_id}/km", response_model=Page[KmReadingOut])
def list_km(
    vehicle_id: int,
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    service: KmService = Depends(get_km_service),
):
    return service.history(vehicle_id, page=page, size=size)

from app.application.dtos.common import Page
from app.application.dtos.km import KmReadingOut
from app.application.ports import UnitOfWork
from app.domain.errors import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.domain.km import KmReading, KmReadingRepository, KmSource, validate_km_update
from app.domain.roles import Role
from app.domain.user import User
from app.domain.vehicle import Vehicle, VehicleRepository

_FORCE_ADMIN_ONLY = "Somente administradores podem diminuir a quilometragem"
_FORCE_NEEDS_NOTE = "É obrigatório informar uma observação ao forçar a quilometragem"


class KmService:
    """Registro de quilometragem. Reutilizável por check-in (B4) e ordens de serviço (B5).

    - `register`: abre e confirma a própria transação (leitura + `vehicles.current_km`).
    - `record`: faz o mesmo trabalho SEM confirmar, para o chamador (ex.: check-in) incluí-lo
      na sua transação e chamar `uow.commit()` / `uow.rollback()` ao final.
    """

    def __init__(
        self,
        readings: KmReadingRepository,
        vehicles: VehicleRepository,
        uow: UnitOfWork,
    ) -> None:
        self._readings = readings
        self._vehicles = vehicles
        self._uow = uow

    def register(
        self,
        vehicle_id: int,
        km: int,
        source: KmSource,
        note: str | None,
        force: bool,
        actor: User,
    ) -> KmReadingOut:
        try:
            result = self.record(vehicle_id, km, source, note, force, actor)
            self._uow.commit()
        except BaseException:
            self._uow.rollback()
            raise
        return result

    def record(
        self,
        vehicle_id: int,
        km: int,
        source: KmSource,
        note: str | None,
        force: bool,
        actor: User,
    ) -> KmReadingOut:
        """Não confirma a transação; a falha deve ser tratada (rollback) por quem chama."""
        note = note.strip() if note and note.strip() else None
        if force:
            if actor.role is not Role.ADMIN:
                raise PermissionDeniedError(_FORCE_ADMIN_ONLY)
            if note is None:
                raise BusinessRuleError(_FORCE_NEEDS_NOTE)
        vehicle = self._vehicles.get_for_update(vehicle_id)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado")
        if not validate_km_update(vehicle.current_km, km, force):
            latest = self._readings.latest_for_vehicle(vehicle_id)
            if latest is not None:
                return KmReadingOut.from_entity(latest)
        saved = self._readings.add(
            KmReading(
                id=None,
                vehicle_id=vehicle_id,
                km=km,
                source=source,
                note=note,
                recorded_by_id=actor.id,
            )
        )
        self._vehicles.update_current_km(vehicle_id, km, actor_id=actor.id)
        return KmReadingOut.from_entity(saved)

    def history(self, vehicle_id: int, *, page: int, size: int) -> Page[KmReadingOut]:
        self._vehicle_or_404(vehicle_id)
        readings, total = self._readings.list_page(
            vehicle_id, offset=(page - 1) * size, limit=size
        )
        return Page[KmReadingOut](
            items=[KmReadingOut.from_entity(r) for r in readings],
            total=total,
            page=page,
            size=size,
        )

    def _vehicle_or_404(self, vehicle_id: int) -> Vehicle:
        vehicle = self._vehicles.get_by_id(vehicle_id)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado")
        return vehicle

from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.errors import ConflictError, NotFoundError
from app.domain.vehicle import Fuel, Vehicle
from app.infrastructure.db.models.vehicle import VehicleModel

PLATE_TAKEN = "Placa já cadastrada"
CHASSIS_TAKEN = "Chassi já cadastrado"


def _escape(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _conflict_message(error: IntegrityError) -> str:
    """Descobre qual restrição única falhou (SQLite/MySQL citam o nome da coluna/índice)."""
    detail = str(error.orig).lower()
    if "active_chassis" in detail:
        return CHASSIS_TAKEN
    if "active_plate" in detail:
        return PLATE_TAKEN
    return "Conflito ao salvar o veículo"


class SqlVehicleRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(model: VehicleModel) -> Vehicle:
        return Vehicle(
            id=model.id,
            customer_id=model.customer_id,
            plate=model.plate,
            brand=model.brand,
            model=model.model,
            year=model.year,
            fuel=Fuel(model.fuel),
            color=model.color,
            engine=model.engine,
            chassis=model.chassis,
            renavam=model.renavam,
            current_km=model.current_km,
            created_by_id=model.created_by_id,
            updated_by_id=model.updated_by_id,
        )

    @staticmethod
    def _alive() -> Select[tuple[VehicleModel]]:
        return select(VehicleModel).where(VehicleModel.deleted_at.is_(None))

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError as error:
            self._db.rollback()
            raise ConflictError(_conflict_message(error)) from None

    def _get_alive_model(self, vehicle_id: int) -> VehicleModel:
        model = self._db.scalar(self._alive().where(VehicleModel.id == vehicle_id))
        if model is None:
            raise NotFoundError("Veículo não encontrado")
        return model

    def get_by_id(self, vehicle_id: int) -> Vehicle | None:
        model = self._db.scalar(self._alive().where(VehicleModel.id == vehicle_id))
        return self._to_entity(model) if model else None

    def _exists(self, column, value: str, exclude_id: int | None) -> bool:
        stmt = (
            select(func.count())
            .select_from(VehicleModel)
            .where(VehicleModel.deleted_at.is_(None), column == value)
        )
        if exclude_id is not None:
            stmt = stmt.where(VehicleModel.id != exclude_id)
        return bool(self._db.scalar(stmt))

    def plate_exists(self, plate: str, *, exclude_id: int | None = None) -> bool:
        return self._exists(VehicleModel.plate, plate, exclude_id)

    def chassis_exists(self, chassis: str, *, exclude_id: int | None = None) -> bool:
        return self._exists(VehicleModel.chassis, chassis, exclude_id)

    def _apply(self, model: VehicleModel, vehicle: Vehicle) -> None:
        model.customer_id = vehicle.customer_id
        model.plate = vehicle.plate
        model.active_plate = vehicle.plate
        model.brand = vehicle.brand
        model.model = vehicle.model
        model.year = vehicle.year
        model.engine = vehicle.engine
        model.fuel = vehicle.fuel.value
        model.color = vehicle.color
        model.chassis = vehicle.chassis
        model.active_chassis = vehicle.chassis
        model.renavam = vehicle.renavam
        model.updated_by_id = vehicle.updated_by_id

    def add(self, vehicle: Vehicle) -> Vehicle:
        model = VehicleModel(current_km=0, created_by_id=vehicle.created_by_id)
        self._apply(model, vehicle)
        self._db.add(model)
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def update(self, vehicle: Vehicle) -> Vehicle:
        model = self._get_alive_model(vehicle.id)
        self._apply(model, vehicle)
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def soft_delete(self, vehicle_id: int, *, actor_id: int | None = None) -> None:
        model = self._get_alive_model(vehicle_id)
        model.active_plate = None
        model.active_chassis = None
        model.updated_by_id = actor_id
        model.deleted_at = datetime.now(UTC).replace(tzinfo=None)
        self._db.commit()

    def list_page(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None,
        customer_id: int | None = None,
    ) -> tuple[list[Vehicle], int]:
        stmt = self._alive()
        if customer_id is not None:
            stmt = stmt.where(VehicleModel.customer_id == customer_id)
        if search and search.strip():
            like = f"%{_escape(search.strip())}%"
            stmt = stmt.where(
                or_(
                    VehicleModel.plate.ilike(like, escape="\\"),
                    VehicleModel.brand.ilike(like, escape="\\"),
                    VehicleModel.model.ilike(like, escape="\\"),
                )
            )
        total = self._db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self._db.scalars(stmt.order_by(VehicleModel.id).offset(offset).limit(limit)).all()
        return [self._to_entity(r) for r in rows], total

from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.checkin import (
    Checkin,
    CheckinPhoto,
    ChecklistEntry,
    ChecklistItem,
    Condition,
    FuelLevel,
)
from app.domain.errors import ConflictError
from app.infrastructure.db.models.checkin import (
    CheckinChecklistItemModel,
    CheckinModel,
    CheckinPhotoModel,
)


def _photo_to_entity(model: CheckinPhotoModel) -> CheckinPhoto:
    return CheckinPhoto(
        id=model.id,
        checkin_id=model.checkin_id,
        storage_key=model.storage_key,
        content_type=model.content_type,
        size_bytes=model.size_bytes,
        created_at=model.created_at,
        confirmed_at=model.confirmed_at,
    )


class SqlCheckinRepository:
    """`add` só faz flush: o commit/rollback pertence a quem orquestra a transação."""

    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(
        model: CheckinModel,
        items: list[CheckinChecklistItemModel] | None = None,
        photos: list[CheckinPhotoModel] | None = None,
    ) -> Checkin:
        return Checkin(
            id=model.id,
            vehicle_id=model.vehicle_id,
            user_id=model.user_id,
            km=model.km,
            fuel_level=FuelLevel(model.fuel_level),
            damages=model.damages,
            accessories=model.accessories,
            notes=model.notes,
            created_at=model.created_at,
            created_by_id=model.created_by_id,
            checklist=[
                ChecklistEntry(ChecklistItem(i.item), Condition(i.condition), i.note)
                for i in items or []
            ],
            photos=[_photo_to_entity(p) for p in photos or []],
        )

    def add(self, checkin: Checkin) -> Checkin:
        model = CheckinModel(
            vehicle_id=checkin.vehicle_id,
            user_id=checkin.user_id,
            km=checkin.km,
            fuel_level=checkin.fuel_level.value,
            damages=checkin.damages,
            accessories=checkin.accessories,
            notes=checkin.notes,
            created_by_id=checkin.created_by_id,
        )
        try:
            self._db.add(model)
            self._db.flush()
            items = [
                CheckinChecklistItemModel(
                    checkin_id=model.id,
                    item=entry.item.value,
                    condition=entry.condition.value,
                    note=entry.note,
                )
                for entry in checkin.checklist
            ]
            self._db.add_all(items)
            self._db.flush()
        except IntegrityError as exc:
            raise ConflictError("Check-in inválido ou duplicado") from exc
        self._db.refresh(model)
        return self._to_entity(model, items)

    def get_by_id(self, checkin_id: int) -> Checkin | None:
        model = self._db.get(CheckinModel, checkin_id)
        if model is None:
            return None
        items = self._db.scalars(
            select(CheckinChecklistItemModel)
            .where(CheckinChecklistItemModel.checkin_id == checkin_id)
            .order_by(CheckinChecklistItemModel.id)
        ).all()
        photos = self._db.scalars(
            select(CheckinPhotoModel)
            .where(CheckinPhotoModel.checkin_id == checkin_id)
            .order_by(CheckinPhotoModel.id)
        ).all()
        return self._to_entity(model, list(items), list(photos))

    def list_page(
        self, *, offset: int, limit: int, vehicle_id: int | None = None
    ) -> tuple[list[Checkin], int]:
        base = select(CheckinModel)
        if vehicle_id is not None:
            base = base.where(CheckinModel.vehicle_id == vehicle_id)
        total = self._db.scalar(select(func.count()).select_from(base.subquery())) or 0
        rows = self._db.scalars(
            base.order_by(CheckinModel.created_at.desc(), CheckinModel.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return [self._to_entity(r) for r in rows], total


class SqlCheckinPhotoRepository:
    """Sem commits: o service controla a transação."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def add(self, photo: CheckinPhoto) -> CheckinPhoto:
        model = CheckinPhotoModel(
            checkin_id=photo.checkin_id,
            storage_key=photo.storage_key,
            content_type=photo.content_type,
            size_bytes=photo.size_bytes,
            confirmed_at=photo.confirmed_at,
        )
        if photo.created_at is not None:  # o service define o relógio (UTC ingênuo)
            model.created_at = photo.created_at
        try:
            self._db.add(model)
            self._db.flush()
        except IntegrityError as exc:
            raise ConflictError("Foto duplicada") from exc
        self._db.refresh(model)
        return _photo_to_entity(model)

    def _get_model(self, checkin_id: int, photo_id: int) -> CheckinPhotoModel | None:
        return self._db.scalar(
            select(CheckinPhotoModel).where(
                CheckinPhotoModel.id == photo_id, CheckinPhotoModel.checkin_id == checkin_id
            )
        )

    def get(self, checkin_id: int, photo_id: int) -> CheckinPhoto | None:
        model = self._get_model(checkin_id, photo_id)
        return _photo_to_entity(model) if model else None

    def count_active(self, checkin_id: int, *, pending_since: datetime) -> int:
        return (
            self._db.scalar(
                select(func.count())
                .select_from(CheckinPhotoModel)
                .where(
                    CheckinPhotoModel.checkin_id == checkin_id,
                    or_(
                        CheckinPhotoModel.confirmed_at.is_not(None),
                        and_(
                            CheckinPhotoModel.confirmed_at.is_(None),
                            CheckinPhotoModel.created_at >= pending_since,
                        ),
                    ),
                )
            )
            or 0
        )

    def count_confirmed(self, checkin_id: int) -> int:
        return (
            self._db.scalar(
                select(func.count())
                .select_from(CheckinPhotoModel)
                .where(
                    CheckinPhotoModel.checkin_id == checkin_id,
                    CheckinPhotoModel.confirmed_at.is_not(None),
                )
            )
            or 0
        )

    def mark_confirmed(self, photo_id: int, *, size_bytes: int, at: datetime) -> None:
        model = self._db.get(CheckinPhotoModel, photo_id)
        if model is not None:
            model.size_bytes = size_bytes
            model.confirmed_at = at
            self._db.flush()

    def delete(self, photo_id: int) -> None:
        model = self._db.get(CheckinPhotoModel, photo_id)
        if model is not None:
            self._db.delete(model)
            self._db.flush()

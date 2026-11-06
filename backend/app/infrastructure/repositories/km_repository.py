from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.km import KmReading, KmSource
from app.infrastructure.db.models.km_reading import KmReadingModel


class SqlKmReadingRepository:
    """`add` só faz flush: o commit/rollback pertence a quem orquestra a transação."""

    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(model: KmReadingModel) -> KmReading:
        return KmReading(
            id=model.id,
            vehicle_id=model.vehicle_id,
            km=model.km,
            source=KmSource(model.source),
            note=model.note,
            recorded_by_id=model.recorded_by_id,
            created_at=model.created_at,
        )

    def add(self, reading: KmReading) -> KmReading:
        model = KmReadingModel(
            vehicle_id=reading.vehicle_id,
            km=reading.km,
            source=reading.source.value,
            note=reading.note,
            recorded_by_id=reading.recorded_by_id,
        )
        self._db.add(model)
        self._db.flush()
        self._db.refresh(model)
        return self._to_entity(model)

    def latest_for_vehicle(self, vehicle_id: int) -> KmReading | None:
        model = self._db.scalar(
            select(KmReadingModel)
            .where(KmReadingModel.vehicle_id == vehicle_id)
            .order_by(KmReadingModel.created_at.desc(), KmReadingModel.id.desc())
            .limit(1)
        )
        return self._to_entity(model) if model else None

    def list_page(
        self, vehicle_id: int, *, offset: int, limit: int
    ) -> tuple[list[KmReading], int]:
        base = select(KmReadingModel).where(KmReadingModel.vehicle_id == vehicle_id)
        total = self._db.scalar(select(func.count()).select_from(base.subquery())) or 0
        rows = self._db.scalars(
            base.order_by(KmReadingModel.created_at.desc(), KmReadingModel.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return [self._to_entity(r) for r in rows], total

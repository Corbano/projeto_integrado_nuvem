"""Aplica os dados de demonstração usando os serviços reais (validações e auditoria incluídas)."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.application.dtos.customer import CustomerCreate
from app.application.dtos.vehicle import VehicleCreate
from app.application.services.customer_service import CustomerService
from app.application.services.km_service import KmService
from app.application.services.vehicle_service import VehicleService
from app.domain.km import KmSource
from app.domain.user import User
from app.infrastructure.db.models.km_reading import KmReadingModel
from app.infrastructure.db.unit_of_work import SqlUnitOfWork
from app.infrastructure.repositories.customer_repository import SqlCustomerRepository
from app.infrastructure.repositories.km_repository import SqlKmReadingRepository
from app.infrastructure.repositories.vehicle_repository import SqlVehicleRepository
from app.seed.demo_data import build_customers, build_vehicles


@dataclass
class SeedSummary:
    customers_created: int = 0
    customers_existing: int = 0
    vehicles_created: int = 0
    vehicles_existing: int = 0

    @property
    def existing(self) -> int:
        return self.customers_existing + self.vehicles_existing

    def message(self) -> str:
        return (
            f"{self.customers_created} clientes e {self.vehicles_created} veículos criados, "
            f"{self.existing} já existiam"
        )


def seed_demo(db: Session, actor: User, *, dry_run: bool = False) -> SeedSummary:
    customers_repo = SqlCustomerRepository(db)
    vehicles_repo = SqlVehicleRepository(db)
    customers = CustomerService(customers_repo)
    vehicles = VehicleService(vehicles_repo, customers_repo)
    km = KmService(SqlKmReadingRepository(db), vehicles_repo, SqlUnitOfWork(db))
    actor_id = actor.id
    assert actor_id is not None
    summary = SeedSummary()
    ids: dict[str, int | None] = {}
    now = datetime.now(UTC).replace(tzinfo=None)

    for seed in build_customers():
        if customers_repo.document_exists(seed.document):
            summary.customers_existing += 1
            found, _ = customers_repo.list_page(offset=0, limit=50, search=seed.document)
            ids[seed.document] = next((c.id for c in found if c.document == seed.document), None)
            continue
        summary.customers_created += 1
        if dry_run:
            ids[seed.document] = None
            continue
        created = customers.create(
            CustomerCreate(
                name=seed.name,
                document=seed.document,
                phone=seed.phone,
                email=seed.email,
                notes=seed.notes,
            ),
            actor_id=actor_id,
        )
        ids[seed.document] = created.id

    for seed in build_vehicles(now.year):
        if vehicles_repo.plate_exists(seed.plate):
            summary.vehicles_existing += 1
            continue
        summary.vehicles_created += 1
        owner_id = ids.get(seed.owner_document)
        if dry_run or owner_id is None:
            continue
        vehicle = vehicles.create(
            VehicleCreate(
                customer_id=owner_id,
                plate=seed.plate,
                brand=seed.brand,
                model=seed.model,
                year=seed.year,
                fuel=seed.fuel,
                color=seed.color,
                engine=seed.engine,
                chassis=seed.chassis,
                renavam=seed.renavam,
            ),
            actor_id=actor_id,
        )
        for reading in seed.readings:
            saved = km.register(vehicle.id, reading.km, KmSource.MANUAL, None, False, actor)
            db.execute(
                update(KmReadingModel)
                .where(KmReadingModel.id == saved.id)
                .values(created_at=now - timedelta(days=reading.days_ago))
            )
            db.commit()
    return summary

import pytest

from app.domain.customer import Customer
from app.domain.errors import NotFoundError
from app.domain.km import KmReading, KmSource
from app.domain.vehicle import Fuel, Vehicle
from app.infrastructure.repositories.customer_repository import SqlCustomerRepository
from app.infrastructure.repositories.km_repository import SqlKmReadingRepository
from app.infrastructure.repositories.vehicle_repository import SqlVehicleRepository


@pytest.fixture
def vehicles(db_session):
    return SqlVehicleRepository(db_session)


@pytest.fixture
def kms(db_session):
    return SqlKmReadingRepository(db_session)


@pytest.fixture
def vehicle_id(db_session, vehicles):
    cid = (
        SqlCustomerRepository(db_session)
        .add(Customer(id=None, name="Cliente Ficticio", document="52998224725"))
        .id
    )
    return vehicles.add(
        Vehicle(
            id=None, customer_id=cid, plate="ABC1234", brand="M", model="X",
            year=2020, fuel=Fuel.FLEX, color="Prata",
        )
    ).id


def reading(vehicle_id, km, note=None):
    return KmReading(
        id=None, vehicle_id=vehicle_id, km=km, source=KmSource.MANUAL, note=note,
        recorded_by_id=None,
    )


def test_add_roundtrip_and_latest(kms, vehicle_id):
    first = kms.add(reading(vehicle_id, 10))
    second = kms.add(reading(vehicle_id, 20, note="x"))

    assert first.id is not None and first.created_at is not None
    assert kms.latest_for_vehicle(vehicle_id).id == second.id


def test_list_page_most_recent_first(kms, vehicle_id):
    for km in (10, 20, 30):
        kms.add(reading(vehicle_id, km))

    items, total = kms.list_page(vehicle_id, offset=0, limit=2)
    assert total == 3
    assert [i.km for i in items] == [30, 20]
    items, _ = kms.list_page(vehicle_id, offset=2, limit=2)
    assert [i.km for i in items] == [10]


def test_vehicle_update_current_km_does_not_commit(vehicles, vehicle_id, db_session):
    assert vehicles.get_for_update(vehicle_id).current_km == 0
    vehicles.update_current_km(vehicle_id, 500, actor_id=None)
    db_session.rollback()
    assert vehicles.get_by_id(vehicle_id).current_km == 0

    vehicles.update_current_km(vehicle_id, 500, actor_id=None)
    db_session.commit()
    assert vehicles.get_by_id(vehicle_id).current_km == 500


def test_update_current_km_missing_vehicle(vehicles):
    with pytest.raises(NotFoundError):
        vehicles.update_current_km(999, 1, actor_id=None)

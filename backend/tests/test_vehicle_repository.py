import pytest

from app.domain.customer import Customer
from app.domain.errors import ConflictError, NotFoundError
from app.domain.vehicle import Fuel, Vehicle
from app.infrastructure.repositories.customer_repository import SqlCustomerRepository
from app.infrastructure.repositories.vehicle_repository import SqlVehicleRepository

CHASSIS_A = "ABCDEFGH123456789"
CHASSIS_B = "JKLMNPRS123456789"


@pytest.fixture
def repo(db_session):
    return SqlVehicleRepository(db_session)


@pytest.fixture
def customer_id(db_session):
    return (
        SqlCustomerRepository(db_session)
        .add(Customer(id=None, name="Cliente Ficticio", document="52998224725"))
        .id
    )


def new_vehicle(customer_id, plate="ABC1234", **kwargs) -> Vehicle:
    data = {"brand": "Marca", "model": "Modelo", "year": 2020, "fuel": Fuel.FLEX, "color": "Prata"}
    data.update(kwargs)
    return Vehicle(id=None, customer_id=customer_id, plate=plate, **data)


def test_add_roundtrip(repo, customer_id):
    saved = repo.add(new_vehicle(customer_id, chassis=CHASSIS_A, renavam="123456789"))

    assert saved.id is not None
    assert saved.current_km == 0
    assert repo.get_by_id(saved.id) == saved


def test_db_rejects_duplicate_plate_without_precheck(repo, customer_id):
    repo.add(new_vehicle(customer_id))

    with pytest.raises(ConflictError, match="Placa já cadastrada"):
        repo.add(new_vehicle(customer_id))
    assert repo.add(new_vehicle(customer_id, plate="DEF5678")).id is not None


def test_db_rejects_duplicate_chassis_without_precheck(repo, customer_id):
    repo.add(new_vehicle(customer_id, chassis=CHASSIS_A))

    with pytest.raises(ConflictError, match="Chassi já cadastrado"):
        repo.add(new_vehicle(customer_id, plate="DEF5678", chassis=CHASSIS_A))


def test_null_chassis_does_not_collide(repo, customer_id):
    repo.add(new_vehicle(customer_id))
    assert repo.add(new_vehicle(customer_id, plate="DEF5678")).id is not None


def test_update_to_taken_plate_conflicts_and_update_ignores_current_km(repo, customer_id):
    repo.add(new_vehicle(customer_id))
    second = repo.add(new_vehicle(customer_id, plate="DEF5678"))
    second.current_km = 999
    second.color = "Preto"
    saved = repo.update(second)
    assert saved.color == "Preto"
    assert saved.current_km == 0

    second.plate = "ABC1234"
    with pytest.raises(ConflictError, match="Placa já cadastrada"):
        repo.update(second)


def test_soft_delete_frees_plate_and_chassis(repo, customer_id):
    saved = repo.add(new_vehicle(customer_id, chassis=CHASSIS_A))
    repo.soft_delete(saved.id, actor_id=None)

    assert repo.get_by_id(saved.id) is None
    assert not repo.plate_exists("ABC1234")
    assert not repo.chassis_exists(CHASSIS_A)
    assert repo.add(new_vehicle(customer_id, chassis=CHASSIS_A)).id != saved.id
    with pytest.raises(NotFoundError):
        repo.soft_delete(saved.id)


def test_exists_with_exclude(repo, customer_id):
    saved = repo.add(new_vehicle(customer_id, chassis=CHASSIS_A))

    assert repo.plate_exists("ABC1234")
    assert not repo.plate_exists("ABC1234", exclude_id=saved.id)
    assert repo.chassis_exists(CHASSIS_A)
    assert not repo.chassis_exists(CHASSIS_A, exclude_id=saved.id)
    assert not repo.chassis_exists(CHASSIS_B)


def test_list_page_search_filter_and_escape(repo, db_session, customer_id):
    other = (
        SqlCustomerRepository(db_session)
        .add(Customer(id=None, name="Outro", document="11144477735"))
        .id
    )
    repo.add(new_vehicle(customer_id, brand="Fiat", model="Uno"))
    repo.add(new_vehicle(customer_id, plate="DEF5678", brand="Ford", model="Ka_100"))
    repo.add(new_vehicle(other, plate="GHI9J01", brand="Fiat", model="Mobi"))

    def total(q=None, cid=None):
        return repo.list_page(offset=0, limit=10, search=q, customer_id=cid)[1]

    assert total() == 3
    assert total(cid=customer_id) == 2
    assert total(q="abc") == 1
    assert total(q="fiat") == 2
    assert total(q="a_1") == 1
    assert total(q="_") == 1
    assert total(q="%") == 0
    items, count = repo.list_page(offset=2, limit=2, search=None, customer_id=None)
    assert (len(items), count) == (1, 3)


def test_has_vehicles_via_customer_repo(repo, db_session, customer_id):
    customers = SqlCustomerRepository(db_session)
    assert not customers.has_vehicles(customer_id)
    saved = repo.add(new_vehicle(customer_id))
    assert customers.has_vehicles(customer_id)
    repo.soft_delete(saved.id)
    assert not customers.has_vehicles(customer_id)

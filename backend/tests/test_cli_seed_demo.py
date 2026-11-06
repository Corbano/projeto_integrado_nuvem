import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.cli import run
from app.domain.roles import Role
from app.infrastructure.db.models.km_reading import KmReadingModel
from app.infrastructure.repositories.km_repository import SqlKmReadingRepository
from app.infrastructure.repositories.vehicle_repository import SqlVehicleRepository
from app.seed.demo_data import build_customers, build_vehicles


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _dev_env(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)


def _seed(session_factory, *extra):
    return run(["seed-demo", *extra], session_factory=session_factory)


def test_creates_expected_counts(session_factory, make_user, capsys):
    admin = make_user(role=Role.ADMIN)

    assert _seed(session_factory) == 0

    assert "18 clientes e 28 veículos criados, 0 já existiam" in capsys.readouterr().out
    with session_factory() as db:
        repo = SqlVehicleRepository(db)
        items, total = repo.list_page(offset=0, limit=100, search=None)
        assert total == 28
        assert all(v.created_by_id == admin.id for v in items)


def test_second_run_is_idempotent(session_factory, make_user, capsys):
    make_user(role=Role.ADMIN)
    _seed(session_factory)
    capsys.readouterr()

    assert _seed(session_factory) == 0

    assert "0 clientes e 0 veículos criados, 46 já existiam" in capsys.readouterr().out
    with session_factory() as db:
        _, total = SqlVehicleRepository(db).list_page(offset=0, limit=1, search=None)
    assert total == 28


def test_count_only_writes_nothing(session_factory, make_user, capsys):
    make_user(role=Role.ADMIN)

    assert _seed(session_factory, "--count-only") == 0

    assert "18 clientes e 28 veículos criados" in capsys.readouterr().out
    with session_factory() as db:
        _, total = SqlVehicleRepository(db).list_page(offset=0, limit=1, search=None)
    assert total == 0


def test_refuses_in_production(session_factory, make_user, monkeypatch, capsys):
    make_user(role=Role.ADMIN)
    monkeypatch.setenv("ENVIRONMENT", "Production")

    assert _seed(session_factory) == 1

    assert "production" in capsys.readouterr().err
    with session_factory() as db:
        _, total = SqlVehicleRepository(db).list_page(offset=0, limit=1, search=None)
    assert total == 0


def test_errors_without_admin(session_factory, make_user, capsys):
    make_user(role=Role.RECEPTION)

    assert _seed(session_factory) == 1

    assert "create-admin" in capsys.readouterr().err


def test_actor_email_must_be_admin(session_factory, make_user, capsys):
    make_user(role=Role.ADMIN)

    assert _seed(session_factory, "--actor-email", "nao@existe.com") == 1
    assert "create-admin" in capsys.readouterr().err


def test_actor_email_is_used(session_factory, make_user):
    make_user(role=Role.ADMIN)
    second = make_user(role=Role.ADMIN, email="segundo@example.com")

    assert _seed(session_factory, "--actor-email", "segundo@example.com") == 0

    with session_factory() as db:
        items, _ = SqlVehicleRepository(db).list_page(offset=0, limit=5, search=None)
    assert items[0].created_by_id == second.id


def test_km_ascending_and_current_km_is_last(session_factory, make_user):
    make_user(role=Role.ADMIN)
    _seed(session_factory)

    with session_factory() as db:
        vehicles, _ = SqlVehicleRepository(db).list_page(offset=0, limit=100, search=None)
        seeds = {v.plate: v for v in build_vehicles()}
        assert len(vehicles) == 28
        for vehicle in vehicles:
            rows = db.scalars(
                select(KmReadingModel)
                .where(KmReadingModel.vehicle_id == vehicle.id)
                .order_by(KmReadingModel.created_at, KmReadingModel.id)
            ).all()
            kms = [r.km for r in rows]
            assert kms == [r.km for r in seeds[vehicle.plate].readings]
            assert kms == sorted(kms)
            assert vehicle.current_km == kms[-1] > 0
            assert SqlKmReadingRepository(db).latest_for_vehicle(vehicle.id).km == kms[-1]


def test_no_real_personal_data():
    for c in build_customers():
        if c.email:
            assert "example.com" in c.email
        assert not (c.email or "").endswith(("@gmail.com", "@hotmail.com", "@outlook.com"))

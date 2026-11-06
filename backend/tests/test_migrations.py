from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

BACKEND = Path(__file__).resolve().parent.parent


def alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def test_upgrade_creates_users_and_downgrade_removes_it(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "head")
    inspector = inspect(create_engine(url))
    columns = {c["name"] for c in inspector.get_columns("users")}

    assert "users" in inspector.get_table_names()
    assert {
        "id", "name", "email", "password_hash", "role", "active",
        "created_at", "updated_at", "deleted_at",
    } <= columns
    indexes = inspector.get_indexes("users")
    assert any(ix["unique"] and ix["column_names"] == ["email"] for ix in indexes)

    command.downgrade(cfg, "base")
    assert "users" not in inspect(create_engine(url)).get_table_names()


def test_migration_0002_creates_and_drops_customers(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration_customers.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "head")
    inspector = inspect(create_engine(url))
    columns = {c["name"] for c in inspector.get_columns("customers")}

    assert {
        "id", "name", "document", "phone", "email", "notes",
        "created_at", "updated_at", "deleted_at", "created_by_id", "updated_by_id",
    } <= columns
    indexed = {tuple(ix["column_names"]) for ix in inspector.get_indexes("customers")}
    assert ("name",) in indexed
    assert ("document",) in indexed
    fks = {fk["referred_table"] for fk in inspector.get_foreign_keys("customers")}
    assert fks == {"users"}

    command.downgrade(cfg, "0001")
    after = inspect(create_engine(url))
    assert "customers" not in after.get_table_names()
    assert "users" in after.get_table_names()


def test_migration_0003_adds_unique_active_document_and_downgrades(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration_active_document.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "0002")
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO customers (name, document, deleted_at) VALUES "
            "('Ativo Ficticio', '52998224725', NULL), "
            "('Excluido Ficticio', '11144477735', '2026-01-01 00:00:00')"
        )
    command.upgrade(cfg, "head")

    inspector = inspect(create_engine(url))
    assert "active_document" in {c["name"] for c in inspector.get_columns("customers")}
    assert any(
        ix["unique"] and ix["column_names"] == ["active_document"]
        for ix in inspector.get_indexes("customers")
    )
    with create_engine(url).connect() as conn:
        rows = dict(
            conn.exec_driver_sql("SELECT document, active_document FROM customers").fetchall()
        )
    assert rows == {"52998224725": "52998224725", "11144477735": None}

    command.downgrade(cfg, "0002")
    after = inspect(create_engine(url))
    assert "active_document" not in {c["name"] for c in after.get_columns("customers")}
    assert "customers" in after.get_table_names()


def test_migration_0004_creates_and_drops_vehicles(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration_vehicles.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "head")
    inspector = inspect(create_engine(url))
    columns = {c["name"] for c in inspector.get_columns("vehicles")}

    assert {
        "id", "customer_id", "plate", "active_plate", "brand", "model", "year", "engine",
        "fuel", "color", "chassis", "active_chassis", "renavam", "current_km",
        "created_at", "updated_at", "deleted_at", "created_by_id", "updated_by_id",
    } <= columns
    indexes = inspector.get_indexes("vehicles")
    indexed = {tuple(ix["column_names"]) for ix in indexes}
    assert ("plate",) in indexed
    assert ("customer_id",) in indexed
    unique = {tuple(ix["column_names"]) for ix in indexes if ix["unique"]}
    assert unique == {("active_plate",), ("active_chassis",)}
    assert not any(
        ix["unique"] for ix in indexes if ix["column_names"] in (["plate"], ["chassis"])
    )
    fks = {fk["referred_table"] for fk in inspector.get_foreign_keys("vehicles")}
    assert fks == {"users", "customers"}

    command.downgrade(cfg, "0003")
    after = inspect(create_engine(url))
    assert "vehicles" not in after.get_table_names()
    assert "customers" in after.get_table_names()


def test_migration_0005_creates_and_drops_km_readings(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration_km.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "head")
    inspector = inspect(create_engine(url))
    columns = {c["name"] for c in inspector.get_columns("km_readings")}

    assert {
        "id", "vehicle_id", "km", "source", "note", "recorded_by_id", "created_at",
    } <= columns
    indexed = {tuple(ix["column_names"]) for ix in inspector.get_indexes("km_readings")}
    assert ("vehicle_id", "created_at") in indexed
    fks = {fk["referred_table"] for fk in inspector.get_foreign_keys("km_readings")}
    assert fks == {"users", "vehicles"}

    command.downgrade(cfg, "0004")
    after = inspect(create_engine(url))
    assert "km_readings" not in after.get_table_names()
    assert "vehicles" in after.get_table_names()


def test_migration_0006_creates_and_drops_checkin_tables(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration_checkins.db'}"
    cfg = alembic_config(url)

    command.upgrade(cfg, "head")
    inspector = inspect(create_engine(url))

    assert {
        "id", "vehicle_id", "user_id", "km", "fuel_level", "damages", "accessories",
        "notes", "created_at", "created_by_id",
    } <= {c["name"] for c in inspector.get_columns("checkins")}
    assert {"id", "checkin_id", "item", "condition", "note"} <= {
        c["name"] for c in inspector.get_columns("checkin_checklist_items")
    }
    assert {
        "id", "checkin_id", "storage_key", "content_type", "size_bytes", "created_at",
        "confirmed_at",
    } <= {c["name"] for c in inspector.get_columns("checkin_photos")}
    uniques = {
        tuple(u["column_names"])
        for u in inspector.get_unique_constraints("checkin_checklist_items")
    }
    assert ("checkin_id", "item") in uniques
    assert {fk["referred_table"] for fk in inspector.get_foreign_keys("checkins")} == {
        "users", "vehicles",
    }
    indexed = {tuple(ix["column_names"]) for ix in inspector.get_indexes("checkins")}
    assert ("vehicle_id", "created_at") in indexed

    command.downgrade(cfg, "0005")
    after = inspect(create_engine(url)).get_table_names()
    assert not {"checkins", "checkin_checklist_items", "checkin_photos"} & set(after)
    assert "km_readings" in after

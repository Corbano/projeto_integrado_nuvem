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

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.config import get_settings
from app.main import create_app


@pytest.fixture
def settings_env(monkeypatch):
    def apply(environment: str) -> None:
        monkeypatch.setenv("ENVIRONMENT", environment)
        monkeypatch.setenv("JWT_SECRET", "s" * 40)
        monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://u:p@localhost/db")
        get_settings.cache_clear()

    yield apply
    monkeypatch.undo()
    get_settings.cache_clear()


def test_docs_are_disabled_in_production(settings_env):
    settings_env("production")
    client = TestClient(create_app())

    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/health").status_code == 200


def test_docs_are_enabled_in_development(settings_env):
    settings_env("development")
    client = TestClient(create_app())

    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200

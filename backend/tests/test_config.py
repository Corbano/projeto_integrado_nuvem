import pytest
from pydantic import ValidationError

from app.infrastructure.config import Settings


def test_defaults_are_development():
    settings = Settings(_env_file=None)

    assert settings.environment == "development"
    assert settings.access_token_minutes == 60
    assert settings.jwt_algorithm == "HS256"


def test_production_rejects_default_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production", jwt_secret="change-me")


def test_production_rejects_short_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production", jwt_secret="curto")


def test_production_accepts_strong_secret():
    settings = Settings(_env_file=None, environment="production", jwt_secret="x" * 40)

    assert settings.environment == "production"

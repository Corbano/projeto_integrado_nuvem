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


MYSQL_URL = "mysql+pymysql://u:p@h/db"


def test_production_accepts_strong_secret():
    settings = Settings(
        _env_file=None, environment="production", jwt_secret="x" * 40, database_url=MYSQL_URL
    )

    assert settings.environment == "production"


def test_environment_is_normalised_and_triggers_guard():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="Production", jwt_secret="change-me")


def test_environment_with_spaces_and_case_is_normalised():
    settings = Settings(
        _env_file=None,
        environment=" PRODUCTION ",
        jwt_secret="x" * 40,
        database_url=MYSQL_URL,
    )

    assert settings.environment == "production"


def test_production_rejects_sqlite_url():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production", jwt_secret="x" * 40)


def test_rejects_unknown_jwt_algorithm():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_algorithm="none")

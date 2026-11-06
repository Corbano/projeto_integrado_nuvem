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
PROD = {
    "environment": "production",
    "jwt_secret": "x" * 40,
    "database_url": MYSQL_URL,
    "storage_backend": "s3",
    "s3_bucket": "bucket-ficticio",
}


def test_production_accepts_strong_secret():
    settings = Settings(_env_file=None, **PROD)

    assert settings.environment == "production"


def test_environment_is_normalised_and_triggers_guard():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="Production", jwt_secret="change-me")


def test_environment_with_spaces_and_case_is_normalised():
    settings = Settings(
        _env_file=None,
        **{**PROD, "environment": " PRODUCTION "},
    )

    assert settings.environment == "production"


def test_production_rejects_sqlite_url():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{**PROD, "database_url": "sqlite:///./x.db"})


def test_rejects_unknown_jwt_algorithm():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_algorithm="none")


def test_storage_defaults_to_local_in_development():
    settings = Settings(_env_file=None)

    assert settings.storage_backend == "local"
    assert settings.s3_bucket == ""


@pytest.mark.parametrize(
    "override",
    [
        {"storage_backend": "local"},
        {"s3_bucket": ""},
        {"s3_bucket": "   "},
    ],
)
def test_production_requires_s3_backend_and_bucket(override):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{**PROD, **override})


def test_rejects_unknown_storage_backend():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, storage_backend="gcs")

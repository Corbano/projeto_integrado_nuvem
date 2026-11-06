from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Auto Center API"
    environment: str = "development"
    database_url: str = "sqlite:///./autocenter.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_minutes: int = Field(default=60, ge=1)
    bcrypt_rounds: int = Field(default=12, ge=4, le=15)
    cors_origins: list[str] = ["http://localhost:5173"]
    # Fotos do check-in: `local` (dev/testes, disco) ou `s3` (produção; credenciais pela role).
    storage_backend: Literal["local", "s3"] = "local"
    s3_bucket: str = ""
    s3_region: str = "sa-east-1"

    @field_validator("environment", mode="before")
    @classmethod
    def _normalise_environment(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        if self.environment != "production":
            return self
        if self.jwt_secret == "change-me" or len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET forte (>= 32 caracteres) é obrigatório em produção")
        if self.database_url.startswith("sqlite"):
            raise ValueError("DATABASE_URL não pode ser SQLite em produção (use MySQL/RDS)")
        if self.storage_backend != "s3" or not self.s3_bucket.strip():
            raise ValueError("Em produção use STORAGE_BACKEND=s3 com S3_BUCKET preenchido")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

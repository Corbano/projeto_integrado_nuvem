from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Auto Center API"
    environment: str = "development"
    database_url: str = "sqlite:///./autocenter.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=60, ge=1)
    bcrypt_rounds: int = Field(default=12, ge=4, le=15)
    cors_origins: list[str] = ["http://localhost:5173"]

    @model_validator(mode="after")
    def _validate_production_secret(self) -> "Settings":
        if self.environment == "production" and (
            self.jwt_secret == "change-me" or len(self.jwt_secret) < 32
        ):
            raise ValueError("JWT_SECRET forte (>= 32 caracteres) é obrigatório em produção")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

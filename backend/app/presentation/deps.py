from functools import lru_cache
from pathlib import Path

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.application.ports import FileStorage
from app.application.services.auth_service import AuthService
from app.application.services.checkin_service import CheckinService
from app.application.services.customer_service import CustomerService
from app.application.services.km_service import KmService
from app.application.services.service_order_service import ServiceOrderService
from app.application.services.user_service import UserService
from app.application.services.vehicle_service import VehicleService
from app.domain.errors import AuthenticationError, PermissionDeniedError
from app.domain.roles import Role
from app.domain.user import User
from app.infrastructure.config import get_settings
from app.infrastructure.db.session import get_db
from app.infrastructure.db.unit_of_work import SqlUnitOfWork
from app.infrastructure.repositories.checkin_repository import (
    SqlCheckinPhotoRepository,
    SqlCheckinRepository,
)
from app.infrastructure.repositories.customer_repository import SqlCustomerRepository
from app.infrastructure.repositories.km_repository import SqlKmReadingRepository
from app.infrastructure.repositories.service_order_repository import SqlServiceOrderRepository
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.repositories.vehicle_repository import SqlVehicleRepository
from app.infrastructure.security import BcryptHasher, JwtCodec
from app.infrastructure.storage import LocalFileStorage, S3FileStorage

bearer_scheme = HTTPBearer(auto_error=False)


def get_codec() -> JwtCodec:
    settings = get_settings()
    return JwtCodec(settings.jwt_secret, settings.jwt_algorithm, settings.access_token_minutes)


def get_hasher() -> BcryptHasher:
    return BcryptHasher(rounds=get_settings().bcrypt_rounds)


def get_user_repository(db: Session = Depends(get_db)) -> SqlUserRepository:
    return SqlUserRepository(db)


def get_auth_service(
    users: SqlUserRepository = Depends(get_user_repository),
    hasher: BcryptHasher = Depends(get_hasher),
    codec: JwtCodec = Depends(get_codec),
) -> AuthService:
    return AuthService(users, hasher, codec)


def get_user_service(
    users: SqlUserRepository = Depends(get_user_repository),
    hasher: BcryptHasher = Depends(get_hasher),
) -> UserService:
    return UserService(users, hasher)


def get_customer_service(db: Session = Depends(get_db)) -> CustomerService:
    return CustomerService(SqlCustomerRepository(db))


def get_vehicle_service(db: Session = Depends(get_db)) -> VehicleService:
    return VehicleService(SqlVehicleRepository(db), SqlCustomerRepository(db))


def get_km_service(db: Session = Depends(get_db)) -> KmService:
    return KmService(SqlKmReadingRepository(db), SqlVehicleRepository(db), SqlUnitOfWork(db))


LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[2] / ".storage"


@lru_cache
def get_file_storage() -> FileStorage:
    settings = get_settings()
    if settings.storage_backend == "s3":
        return S3FileStorage(settings.s3_bucket, settings.s3_region)
    return LocalFileStorage(LOCAL_STORAGE_DIR)


def get_checkin_service(
    db: Session = Depends(get_db), storage: FileStorage = Depends(get_file_storage)
) -> CheckinService:
    vehicles = SqlVehicleRepository(db)
    uow = SqlUnitOfWork(db)
    return CheckinService(
        SqlCheckinRepository(db),
        SqlCheckinPhotoRepository(db),
        vehicles,
        KmService(SqlKmReadingRepository(db), vehicles, uow),
        storage,
        uow,
    )


def get_service_order_service(db: Session = Depends(get_db)) -> ServiceOrderService:
    return ServiceOrderService(
        SqlServiceOrderRepository(db),
        SqlVehicleRepository(db),
        SqlCustomerRepository(db),
        SqlCheckinRepository(db),
        SqlUserRepository(db),
        SqlUnitOfWork(db),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    codec: JwtCodec = Depends(get_codec),
    users: SqlUserRepository = Depends(get_user_repository),
) -> User:
    if credentials is None:
        raise AuthenticationError("Autenticação necessária")
    payload = codec.decode(credentials.credentials)
    user = users.get_by_id(payload.user_id)
    if user is None or not user.active:
        raise AuthenticationError("Usuário inválido ou inativo")
    return user


def require_roles(*roles: Role):
    """Dependência que só deixa passar usuários com um dos perfis informados."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise PermissionDeniedError("Acesso negado para este perfil")
        return user

    return dependency

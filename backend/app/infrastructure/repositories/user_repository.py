from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.errors import ConflictError, NotFoundError
from app.domain.roles import Role
from app.domain.user import User
from app.infrastructure.db.models.user import UserModel


class SqlUserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(model: UserModel) -> User:
        return User(
            id=model.id,
            name=model.name,
            email=model.email,
            password_hash=model.password_hash,
            role=Role(model.role),
            active=model.active,
        )

    @staticmethod
    def _alive() -> Select[tuple[UserModel]]:
        return select(UserModel).where(UserModel.deleted_at.is_(None))

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise ConflictError("E-mail já cadastrado") from None

    def _get_alive_model(self, user_id: int) -> UserModel:
        model = self._db.scalar(self._alive().where(UserModel.id == user_id))
        if model is None:
            raise NotFoundError("Usuário não encontrado")
        return model

    def get_by_id(self, user_id: int) -> User | None:
        model = self._db.scalar(self._alive().where(UserModel.id == user_id))
        return self._to_entity(model) if model else None

    def get_by_email(self, email: str) -> User | None:
        model = self._db.scalar(self._alive().where(UserModel.email == email))
        return self._to_entity(model) if model else None

    def email_exists(self, email: str) -> bool:
        count = self._db.scalar(
            select(func.count()).select_from(UserModel).where(UserModel.email == email)
        )
        return bool(count)

    def add(self, user: User) -> User:
        model = UserModel(
            name=user.name,
            email=user.email,
            password_hash=user.password_hash,
            role=user.role.value,
            active=user.active,
        )
        self._db.add(model)
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def update(self, user: User) -> User:
        model = self._get_alive_model(user.id)
        model.name = user.name
        model.password_hash = user.password_hash
        model.role = user.role.value
        model.active = user.active
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def soft_delete(self, user_id: int) -> None:
        model = self._get_alive_model(user_id)
        model.deleted_at = datetime.now(UTC).replace(tzinfo=None)
        self._db.commit()

    def list_page(
        self, *, offset: int, limit: int, search: str | None
    ) -> tuple[list[User], int]:
        stmt = self._alive()
        if search and search.strip():
            esc = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            like = f"%{esc}%"
            stmt = stmt.where(
                or_(
                    UserModel.name.ilike(like, escape="\\"),
                    UserModel.email.ilike(like, escape="\\"),
                )
            )
        total = self._db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self._db.scalars(stmt.order_by(UserModel.id).offset(offset).limit(limit)).all()
        return [self._to_entity(r) for r in rows], total

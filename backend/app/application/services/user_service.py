from app.application.dtos.common import Page
from app.application.dtos.user import UserCreate, UserOut, UserUpdate
from app.application.ports import PasswordHasher
from app.domain.errors import BusinessRuleError, ConflictError, NotFoundError
from app.domain.roles import Role
from app.domain.user import User, UserRepository


class UserService:
    def __init__(self, users: UserRepository, hasher: PasswordHasher) -> None:
        self._users = users
        self._hasher = hasher

    def create(self, data: UserCreate) -> UserOut:
        email = data.email.lower()
        if self._users.email_exists(email):
            raise ConflictError("E-mail já cadastrado")
        saved = self._users.add(
            User(
                id=None,
                name=data.name,
                email=email,
                password_hash=self._hasher.hash(data.password),
                role=data.role,
            )
        )
        return UserOut.from_entity(saved)

    def get(self, user_id: int) -> UserOut:
        return UserOut.from_entity(self._get_or_404(user_id))

    def list_users(self, *, page: int, size: int, search: str | None) -> Page[UserOut]:
        users, total = self._users.list_page(
            offset=(page - 1) * size, limit=size, search=search
        )
        return Page[UserOut](
            items=[UserOut.from_entity(u) for u in users], total=total, page=page, size=size
        )

    def update(self, user_id: int, data: UserUpdate, *, actor_id: int) -> UserOut:
        if user_id == actor_id and (
            data.active is False or (data.role is not None and data.role is not Role.ADMIN)
        ):
            raise BusinessRuleError("Você não pode desativar nem rebaixar o próprio usuário")
        user = self._get_or_404(user_id)
        if data.name is not None:
            user.name = data.name
        if data.role is not None:
            user.role = data.role
        if data.active is not None:
            user.active = data.active
        if data.password is not None:
            user.password_hash = self._hasher.hash(data.password)
        return UserOut.from_entity(self._users.update(user))

    def delete(self, user_id: int, *, actor_id: int) -> None:
        if user_id == actor_id:
            raise BusinessRuleError("Você não pode excluir o próprio usuário")
        self._get_or_404(user_id)
        self._users.soft_delete(user_id)

    def _get_or_404(self, user_id: int) -> User:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado")
        return user

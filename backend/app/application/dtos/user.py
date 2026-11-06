from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.roles import Role
from app.domain.user import User


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role: Role | None = None
    active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: Role
    active: bool

    @classmethod
    def from_entity(cls, user: User) -> "UserOut":
        return cls(
            id=user.id, name=user.name, email=user.email, role=user.role, active=user.active
        )

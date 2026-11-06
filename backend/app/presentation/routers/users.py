from fastapi import APIRouter, Depends, Query, Response, status

from app.application.dtos.common import Page
from app.application.dtos.user import UserCreate, UserOut, UserUpdate
from app.application.services.user_service import UserService
from app.domain.roles import Role
from app.domain.user import User
from app.presentation.deps import get_user_service, require_roles

require_admin = require_roles(Role.ADMIN)

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=Page[UserOut])
def list_users(
    page: int = Query(1, ge=1, le=1_000_000),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    service: UserService = Depends(get_user_service),
):
    return service.list_users(page=page, size=size, search=q)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, service: UserService = Depends(get_user_service)):
    return service.create(body)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, service: UserService = Depends(get_user_service)):
    return service.get(user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    actor: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    return service.update(user_id, body, actor_id=actor.id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    actor: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    service.delete(user_id, actor_id=actor.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

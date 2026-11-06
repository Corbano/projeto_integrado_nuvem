from fastapi import APIRouter, Depends

from app.application.dtos.auth import LoginRequest, TokenResponse
from app.application.dtos.user import UserOut
from app.application.services.auth_service import AuthService
from app.domain.user import User
from app.presentation.deps import get_auth_service, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, service: AuthService = Depends(get_auth_service)):
    return service.login(body.email, body.password)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.from_entity(user)

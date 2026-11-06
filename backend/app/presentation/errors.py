import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.errors import (
    AppError,
    AuthenticationError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

logger = logging.getLogger("autocenter.errors")

_STATUS_BY_ERROR: dict[type[AppError], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    AuthenticationError: 401,
    PermissionDeniedError: 403,
    BusinessRuleError: 422,
}


def _envelope(code: str, message: str, **extra: object) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        status = _STATUS_BY_ERROR.get(type(exc), 400)
        headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
        return JSONResponse(
            status_code=status, content=_envelope(exc.code, exc.message), headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(
                "validation_error", "Dados inválidos", details=jsonable_encoder(exc.errors())
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500, content=_envelope("internal_error", "Erro interno do servidor")
        )

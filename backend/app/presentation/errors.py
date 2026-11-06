import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

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


_CODE_BY_HTTP_STATUS: dict[int, str] = {
    400: "bad_request",
    401: "authentication_failed",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
}


def _envelope(code: str, message: str, **extra: object) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        status = next((s for t in type(exc).__mro__ if (s := _STATUS_BY_ERROR.get(t))), 400)
        headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
        return JSONResponse(
            status_code=status, content=_envelope(exc.code, exc.message), headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Nunca refletir `input`, `ctx` ou `url`: podem conter valores sensíveis enviados.
        details = [
            {k: v for k, v in e.items() if k in ("loc", "msg", "type")}
            for e in jsonable_encoder(exc.errors())
        ]
        return JSONResponse(
            status_code=422,
            content=_envelope("validation_error", "Dados inválidos", details=details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _CODE_BY_HTTP_STATUS.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "Erro na requisição"
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(code, message),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500, content=_envelope("internal_error", "Erro interno do servidor")
        )

class AppError(Exception):
    """Erro de negócio. A camada de apresentação converte em resposta HTTP."""

    code = "app_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    code = "not_found"


class ConflictError(AppError):
    code = "conflict"


class AuthenticationError(AppError):
    code = "authentication_failed"


class PermissionDeniedError(AppError):
    code = "permission_denied"


class StorageUnavailableError(AppError):
    code = "storage_unavailable"


class BusinessRuleError(AppError):
    code = "business_rule_violation"

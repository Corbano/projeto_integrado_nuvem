import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.domain.errors import (
    AuthenticationError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.presentation.errors import register_exception_handlers


class Body(BaseModel):
    qty: int


@pytest.fixture
def client():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/raise/{kind}")
    def raise_error(kind: str):
        errors = {
            "not_found": NotFoundError("Não achei"),
            "conflict": ConflictError("Já existe"),
            "auth": AuthenticationError("Sem credenciais"),
            "forbidden": PermissionDeniedError("Proibido"),
            "rule": BusinessRuleError("Regra violada"),
        }
        raise errors[kind]

    @app.post("/validate")
    def validate(body: Body):
        return body

    return TestClient(app)


@pytest.mark.parametrize(
    ("kind", "status", "code"),
    [
        ("not_found", 404, "not_found"),
        ("conflict", 409, "conflict"),
        ("auth", 401, "authentication_failed"),
        ("forbidden", 403, "permission_denied"),
        ("rule", 422, "business_rule_violation"),
    ],
)
def test_domain_errors_map_to_http(client, kind, status, code):
    response = client.get(f"/raise/{kind}")

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"]


def test_auth_error_sets_www_authenticate(client):
    response = client.get("/raise/auth")

    assert response.headers["www-authenticate"] == "Bearer"


def test_request_validation_error_uses_standard_envelope(client):
    response = client.post("/validate", json={"qty": "abc"})

    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert body["details"]

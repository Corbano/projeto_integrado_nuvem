import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

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


class Credentials(BaseModel):
    password: str = Field(min_length=8)


class SpecificNotFound(NotFoundError):
    pass


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

    @app.post("/credentials")
    def credentials(body: Credentials):
        return {"ok": True}

    @app.get("/subclass")
    def subclass():
        raise SpecificNotFound("Específico")

    @app.get("/http-401")
    def http_401():
        raise HTTPException(401, "x", headers={"WWW-Authenticate": "Bearer"})

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


def test_validation_error_does_not_echo_submitted_values(client):
    response = client.post("/credentials", json={"password": "hunter2"})

    assert response.status_code == 422
    details = response.json()["error"]["details"]
    assert details
    assert all(set(item) <= {"loc", "msg", "type"} for item in details)
    assert "hunter2" not in response.text


def test_unknown_route_uses_envelope(client):
    response = client.get("/nao-existe")

    assert response.status_code == 404
    body = response.json()
    assert "detail" not in body
    assert body["error"]["code"] == "not_found"


def test_method_not_allowed_uses_envelope(client):
    response = client.post("/raise/auth")

    assert response.status_code == 405
    body = response.json()
    assert "detail" not in body
    assert body["error"]["code"] == "method_not_allowed"


def test_http_exception_keeps_headers(client):
    response = client.get("/http-401")

    assert response.status_code == 401
    assert response.json()["error"] == {"code": "authentication_failed", "message": "x"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_domain_error_subclass_maps_via_mro(client):
    response = client.get("/subclass")

    assert response.status_code == 404

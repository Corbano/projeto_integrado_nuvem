from app.domain.roles import Role
from tests.conftest import PASSWORD


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_returns_bearer_token(client, make_user):
    make_user(email="admin@oficina.com")

    response = login(client, "admin@oficina.com")

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_is_case_insensitive_on_email(client, make_user):
    make_user(email="admin@oficina.com")

    assert login(client, "ADMIN@oficina.com").status_code == 200


def test_login_wrong_password_returns_401(client, make_user):
    make_user(email="admin@oficina.com")

    response = login(client, "admin@oficina.com", "senha-errada")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_failed"


def test_login_unknown_email_returns_same_401(client):
    response = login(client, "ninguem@oficina.com")

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Credenciais inválidas"


def test_login_inactive_user_returns_401(client, make_user):
    make_user(email="off@oficina.com", active=False)

    assert login(client, "off@oficina.com").status_code == 401


def test_login_missing_password_returns_validation_error(client):
    response = client.post("/api/v1/auth/login", json={"email": "a@b.com"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_me_returns_current_user(client, make_user):
    make_user(email="mec@oficina.com", role=Role.MECHANIC, name="Carlos")
    token = login(client, "mec@oficina.com").json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "mec@oficina.com"
    assert response.json()["role"] == "mechanic"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()


def test_me_without_token_returns_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_with_garbage_token_returns_401(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer lixo"})

    assert response.status_code == 401

from app.domain.roles import Role

URL = "/api/v1/users"
NEW_USER = {
    "name": "Recepção Um",
    "email": "recepcao@oficina.com",
    "password": "senha-forte-9",
    "role": "reception",
}


def test_admin_creates_user_without_leaking_password(client, auth_header):
    response = client.post(URL, json=NEW_USER, headers=auth_header(Role.ADMIN))

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "recepcao@oficina.com"
    assert body["role"] == "reception"
    assert body["active"] is True
    assert "password" not in body and "password_hash" not in body


def test_created_user_can_log_in(client, auth_header):
    client.post(URL, json=NEW_USER, headers=auth_header(Role.ADMIN))

    response = client.post(
        "/api/v1/auth/login",
        json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
    )

    assert response.status_code == 200


def test_email_is_normalized_to_lowercase(client, auth_header):
    payload = {**NEW_USER, "email": "Recepcao@Oficina.COM"}

    response = client.post(URL, json=payload, headers=auth_header(Role.ADMIN))

    assert response.json()["email"] == "recepcao@oficina.com"


def test_duplicate_email_returns_409(client, auth_header):
    header = auth_header(Role.ADMIN)
    client.post(URL, json=NEW_USER, headers=header)

    response = client.post(URL, json=NEW_USER, headers=header)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_short_password_returns_422(client, auth_header):
    payload = {**NEW_USER, "password": "curta"}

    response = client.post(URL, json=payload, headers=auth_header(Role.ADMIN))

    assert response.status_code == 422


def test_non_admin_is_forbidden(client, auth_header):
    for role in (Role.RECEPTION, Role.MECHANIC):
        response = client.get(URL, headers=auth_header(role))
        assert response.status_code == 403


def test_without_token_returns_401(client):
    assert client.get(URL).status_code == 401


def test_list_paginates_and_searches(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    for i in range(4):
        make_user(email=f"extra{i}@oficina.com", name=f"Extra {i}")

    page = client.get(f"{URL}?page=2&size=2", headers=header).json()
    searched = client.get(f"{URL}?q=extra3", headers=header).json()

    assert page["total"] == 5
    assert page["page"] == 2 and page["size"] == 2
    assert len(page["items"]) == 2
    assert searched["total"] == 1
    assert searched["items"][0]["email"] == "extra3@oficina.com"


def test_list_rejects_invalid_page_size(client, auth_header):
    response = client.get(f"{URL}?size=1000", headers=auth_header(Role.ADMIN))

    assert response.status_code == 422


def test_get_user_by_id_and_missing(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")

    found = client.get(f"{URL}/{other.id}", headers=header)
    missing = client.get(f"{URL}/9999", headers=header)

    assert found.status_code == 200 and found.json()["email"] == "outro@oficina.com"
    assert missing.status_code == 404


def test_patch_updates_role_name_and_active(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com", role=Role.RECEPTION)

    response = client.patch(
        f"{URL}/{other.id}",
        json={"name": "Novo Nome", "role": "mechanic", "active": False},
        headers=header,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Novo Nome"
    assert body["role"] == "mechanic"
    assert body["active"] is False


def test_patch_password_changes_login(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")

    client.patch(f"{URL}/{other.id}", json={"password": "nova-senha-77"}, headers=header)

    ok = client.post(
        "/api/v1/auth/login", json={"email": "outro@oficina.com", "password": "nova-senha-77"}
    )
    assert ok.status_code == 200


def test_delete_is_soft_and_returns_404_afterwards(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")

    deleted = client.delete(f"{URL}/{other.id}", headers=header)
    after = client.get(f"{URL}/{other.id}", headers=header)

    assert deleted.status_code == 204
    assert after.status_code == 404


def test_deleted_user_cannot_log_in_and_email_stays_reserved(client, auth_header, make_user):
    header = auth_header(Role.ADMIN)
    other = make_user(email="outro@oficina.com")
    client.delete(f"{URL}/{other.id}", headers=header)

    login = client.post(
        "/api/v1/auth/login", json={"email": "outro@oficina.com", "password": "senha-segura-1"}
    )
    recreate = client.post(URL, json={**NEW_USER, "email": "outro@oficina.com"}, headers=header)

    assert login.status_code == 401
    assert recreate.status_code == 409


def test_admin_cannot_delete_self(client, auth_header):
    header = auth_header(Role.ADMIN)
    me = client.get("/api/v1/auth/me", headers=header).json()

    response = client.delete(f"{URL}/{me['id']}", headers=header)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "business_rule_violation"


def test_delete_missing_returns_404(client, auth_header):
    response = client.delete(f"{URL}/9999", headers=auth_header(Role.ADMIN))

    assert response.status_code == 404

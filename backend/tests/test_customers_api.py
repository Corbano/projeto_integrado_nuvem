from app.domain.roles import Role
from app.infrastructure.db.models.customer import CustomerModel
from app.infrastructure.repositories.customer_repository import SqlCustomerRepository
from app.infrastructure.repositories.user_repository import SqlUserRepository

URL = "/api/v1/customers"
CPF = "52998224725"
CPF_MASKED = "529.982.247-25"
CPF_2 = "11144477735"
CNPJ = "11222333000181"
NEW = {"name": "Cliente Ficticio Um", "document": CPF_MASKED}


def create(client, header, **overrides):
    return client.post(URL, json={**NEW, **overrides}, headers=header)


def test_reception_creates_customer_and_normalizes_fields(client, auth_header):
    response = create(
        client,
        auth_header(Role.RECEPTION),
        phone="(11) 98888-7777",
        email="Fulano@Example.COM",
        notes="Prefere contato por telefone",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["document"] == CPF
    assert body["phone"] == "11988887777"
    assert body["email"] == "fulano@example.com"
    assert body["notes"] == "Prefere contato por telefone"
    assert body["id"] > 0


def test_accepts_cnpj(client, auth_header):
    response = create(client, auth_header(), document="11.222.333/0001-81")

    assert response.status_code == 201
    assert response.json()["document"] == CNPJ


def test_optional_fields_default_to_null(client, auth_header):
    body = create(client, auth_header()).json()

    assert body["phone"] is None and body["email"] is None and body["notes"] is None


def test_invalid_documents_return_422(client, auth_header):
    header = auth_header()
    for bad in ["529.982.247-24", "11111111111", "123", "00000000000000", "abc"]:
        assert create(client, header, document=bad).status_code == 422


def test_invalid_name_phone_email_return_422(client, auth_header):
    header = auth_header()
    assert create(client, header, name="A").status_code == 422
    assert create(client, header, name="x" * 121).status_code == 422
    assert create(client, header, phone="123").status_code == 422
    assert create(client, header, phone="1" * 12).status_code == 422
    assert create(client, header, email="nao-e-email").status_code == 422


def test_duplicate_document_returns_409_even_with_other_mask(client, auth_header):
    header = auth_header()
    create(client, header)

    response = create(client, header, name="Outro Nome", document=CPF)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_mechanic_can_read_but_not_write(client, auth_header):
    admin = auth_header(Role.ADMIN)
    created = create(client, admin).json()
    mechanic = auth_header(Role.MECHANIC)

    assert client.get(URL, headers=mechanic).status_code == 200
    assert client.get(f"{URL}/{created['id']}", headers=mechanic).status_code == 200
    assert create(client, mechanic, document=CPF_2).status_code == 403
    patch = client.patch(f"{URL}/{created['id']}", json={"name": "Novo Nome"}, headers=mechanic)
    assert patch.status_code == 403
    assert client.delete(f"{URL}/{created['id']}", headers=mechanic).status_code == 403


def test_unauthenticated_returns_401(client):
    assert client.get(URL).status_code == 401
    assert client.post(URL, json=NEW).status_code == 401


def test_get_unknown_returns_404(client, auth_header):
    response = client.get(f"{URL}/999", headers=auth_header())

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_patch_updates_fields_and_clears_optionals(client, auth_header):
    header = auth_header()
    created = create(client, header, phone="11988887777", notes="x").json()

    response = client.patch(
        f"{URL}/{created['id']}",
        json={"name": "Nome Atualizado", "phone": None, "document": CPF_2},
        headers=header,
    )

    body = response.json()
    assert response.status_code == 200
    assert body["name"] == "Nome Atualizado"
    assert body["phone"] is None
    assert body["document"] == CPF_2
    assert body["notes"] == "x"


def test_patch_to_existing_document_returns_409_but_same_document_is_ok(client, auth_header):
    header = auth_header()
    first = create(client, header).json()
    second = create(client, header, name="Segundo Cliente", document=CPF_2).json()

    conflict = client.patch(f"{URL}/{second['id']}", json={"document": CPF}, headers=header)
    same = client.patch(f"{URL}/{first['id']}", json={"document": CPF_MASKED}, headers=header)

    assert conflict.status_code == 409
    assert same.status_code == 200


def test_patch_invalid_values_and_null_required_fields_return_422(client, auth_header):
    header = auth_header()
    created = create(client, header).json()
    url = f"{URL}/{created['id']}"

    assert client.patch(url, json={"document": "123"}, headers=header).status_code == 422
    assert client.patch(url, json={"name": None}, headers=header).status_code == 422
    assert client.patch(url, json={"document": None}, headers=header).status_code == 422


def test_patch_unknown_returns_404(client, auth_header):
    response = client.patch(f"{URL}/999", json={"name": "Nome Novo"}, headers=auth_header())

    assert response.status_code == 404


def test_audit_fields_record_acting_users(client, auth_header, db_session):
    created = create(client, auth_header(Role.RECEPTION)).json()
    client.patch(
        f"{URL}/{created['id']}",
        json={"name": "Editado Por Admin"},
        headers=auth_header(Role.ADMIN),
    )

    db_session.expire_all()
    row = db_session.get(CustomerModel, created["id"])
    users = SqlUserRepository(db_session)
    assert users.get_by_id(row.created_by_id).role is Role.RECEPTION
    assert users.get_by_id(row.updated_by_id).role is Role.ADMIN


def test_delete_is_soft_returns_204_then_404(client, auth_header):
    header = auth_header()
    created = create(client, header).json()

    response = client.delete(f"{URL}/{created['id']}", headers=header)

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"{URL}/{created['id']}", headers=header).status_code == 404
    assert client.delete(f"{URL}/{created['id']}", headers=header).status_code == 404
    assert client.get(URL, headers=header).json()["total"] == 0


def test_document_can_be_reused_after_delete(client, auth_header):
    header = auth_header()
    created = create(client, header).json()
    client.delete(f"{URL}/{created['id']}", headers=header)

    assert create(client, header).status_code == 201


def test_delete_blocked_when_customer_has_vehicles(client, auth_header, monkeypatch):
    monkeypatch.setattr(SqlCustomerRepository, "has_vehicles", lambda self, customer_id: True)
    header = auth_header()
    created = create(client, header).json()

    response = client.delete(f"{URL}/{created['id']}", headers=header)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "business_rule_violation"
    assert error["message"] == "Cliente possui veículos cadastrados"
    assert client.get(f"{URL}/{created['id']}", headers=header).status_code == 200


def test_list_pagination_and_search(client, auth_header):
    header = auth_header()
    create(client, header, name="Maria Ficticia", phone="11988887777", email="maria@example.com")
    create(client, header, name="Joao Ficticio", document=CPF_2)
    create(client, header, name="Empresa Ficticia", document=CNPJ)

    page = client.get(URL, params={"page": 1, "size": 2}, headers=header).json()
    assert (len(page["items"]), page["total"], page["page"], page["size"]) == (2, 3, 1, 2)
    assert len(client.get(URL, params={"page": 2, "size": 2}, headers=header).json()["items"]) == 1

    def count(q):
        return client.get(URL, params={"q": q}, headers=header).json()["total"]

    assert count("maria") == 1
    assert count("Fictici") == 3
    assert count("529982") == 1  # documento sem máscara
    assert count("1114447") == 1
    assert count("11222333") == 1
    assert count("98888") == 1
    assert count("maria@") == 1
    assert count("%") == 0


def test_search_by_masked_document_matches_digits(client, auth_header):
    header = auth_header()
    create(client, header)

    response = client.get(URL, params={"q": CPF_MASKED}, headers=header)

    assert response.json()["total"] == 1


def test_list_rejects_bad_pagination(client, auth_header):
    header = auth_header()

    assert client.get(URL, params={"page": 0}, headers=header).status_code == 422
    assert client.get(URL, params={"size": 101}, headers=header).status_code == 422

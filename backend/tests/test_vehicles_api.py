from app.domain.roles import Role

URL = "/api/v1/vehicles"
CUSTOMERS = "/api/v1/customers"
CHASSIS = "ABCDEFGH123456789"
NEW = {
    "plate": "abc-1234",
    "brand": "Fiat",
    "model": "Uno",
    "year": 2015,
    "fuel": "flex",
    "color": "Prata",
}


def make_customer(client, header, document="52998224725", name="Cliente Ficticio"):
    response = client.post(CUSTOMERS, json={"name": name, "document": document}, headers=header)
    assert response.status_code == 201
    return response.json()["id"]


def create(client, header, customer_id, **overrides):
    return client.post(URL, json={**NEW, "customer_id": customer_id, **overrides}, headers=header)


def test_create_normalizes_and_starts_at_zero_km(client, auth_header):
    header = auth_header(Role.RECEPTION)
    cid = make_customer(client, header)

    response = create(client, header, cid, chassis=" abcdefgh123456789 ", renavam="123456789")

    assert response.status_code == 201
    body = response.json()
    assert body["plate"] == "ABC1234"
    assert body["chassis"] == CHASSIS
    assert body["current_km"] == 0
    assert body["customer_id"] == cid
    assert body["fuel"] == "flex"


def test_mercosul_plate_ok(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    assert create(client, header, cid, plate="abc1d23").json()["plate"] == "ABC1D23"


def test_invalid_payloads_422(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    cases = [
        {"plate": "ABC12"},
        {"year": 1949},
        {"year": 3000},
        {"fuel": "vapor"},
        {"chassis": "ABCDEFGI123456789"},
        {"chassis": "CURTO"},
        {"renavam": "1234"},
        {"renavam": "abcdefghi"},
        {"brand": ""},
        {"current_km": 100},
    ]
    for override in cases:
        response = create(client, header, cid, **override)
        assert response.status_code == 422, override


def test_duplicate_plate_and_chassis_409(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    assert create(client, header, cid, chassis=CHASSIS).status_code == 201

    dup_plate = create(client, header, cid, plate="ABC1234")
    assert dup_plate.status_code == 409
    assert dup_plate.json()["error"]["message"] == "Placa já cadastrada"
    dup_chassis = create(client, header, cid, plate="DEF5678", chassis=CHASSIS)
    assert dup_chassis.status_code == 409
    assert dup_chassis.json()["error"]["message"] == "Chassi já cadastrado"


def test_plate_and_chassis_reusable_after_soft_delete(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    vid = create(client, header, cid, chassis=CHASSIS).json()["id"]
    assert client.delete(f"{URL}/{vid}", headers=header).status_code == 204
    assert client.get(f"{URL}/{vid}", headers=header).status_code == 404

    assert create(client, header, cid, chassis=CHASSIS).status_code == 201


def test_customer_must_exist_and_be_active(client, auth_header):
    header = auth_header()
    assert create(client, header, 999).status_code == 404
    cid = make_customer(client, header)
    assert client.delete(f"{CUSTOMERS}/{cid}", headers=header).status_code == 204
    assert create(client, header, cid).status_code == 404


def test_detail_includes_customer_summary(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header, name="Maria Ficticia")
    vid = create(client, header, cid).json()["id"]

    body = client.get(f"{URL}/{vid}", headers=header).json()

    assert body["customer"] == {"id": cid, "name": "Maria Ficticia"}
    assert body["plate"] == "ABC1234"


def test_get_missing_404(client, auth_header):
    assert client.get(f"{URL}/999", headers=auth_header()).status_code == 404


def test_patch_updates_fields(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    vid = create(client, header, cid, chassis=CHASSIS, engine="1.0").json()["id"]

    response = client.patch(
        f"{URL}/{vid}",
        json={"color": "Preto", "plate": "def-5678", "engine": None, "chassis": None},
        headers=header,
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["color"], body["plate"], body["engine"], body["chassis"]) == (
        "Preto", "DEF5678", None, None,
    )


def test_patch_current_km_forbidden(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    vid = create(client, header, cid).json()["id"]

    assert client.patch(f"{URL}/{vid}", json={"current_km": 5}, headers=header).status_code == 422
    assert client.get(f"{URL}/{vid}", headers=header).json()["current_km"] == 0


def test_patch_validation_and_conflicts(client, auth_header):
    header = auth_header()
    cid = make_customer(client, header)
    create(client, header, cid, chassis=CHASSIS)
    vid = create(client, header, cid, plate="DEF5678").json()["id"]

    def patch(body, target=vid):
        return client.patch(f"{URL}/{target}", json=body, headers=header).status_code

    assert patch({"plate": "XX"}) == 422
    assert patch({"year": None}) == 422
    assert patch({"plate": "abc1234"}) == 409
    assert patch({"chassis": CHASSIS}) == 409
    assert patch({"plate": "def5678"}) == 200  # mantém a própria placa
    assert patch({"color": "x"}, target=999) == 404


def test_transfer_customer(client, auth_header):
    header = auth_header(Role.RECEPTION)
    first = make_customer(client, header)
    second = make_customer(client, header, document="11144477735", name="Segundo")
    vid = create(client, header, first).json()["id"]

    response = client.patch(f"{URL}/{vid}", json={"customer_id": second}, headers=header)
    assert response.status_code == 200
    assert response.json()["customer_id"] == second
    missing = client.patch(f"{URL}/{vid}", json={"customer_id": 999}, headers=header)
    assert missing.status_code == 404
    null = client.patch(f"{URL}/{vid}", json={"customer_id": None}, headers=header)
    assert null.status_code == 422


def test_list_filters_search_and_pagination(client, auth_header):
    header = auth_header()
    first = make_customer(client, header)
    second = make_customer(client, header, document="11144477735", name="Segundo")
    create(client, header, first, plate="ABC1234")
    create(client, header, first, plate="DEF5678", brand="Ford", model="Ka")
    create(client, header, second, plate="GHI9J01")

    def get(**params):
        return client.get(URL, params=params, headers=header).json()

    assert get()["total"] == 3
    assert get(customer_id=first)["total"] == 2
    assert get(q="abc")["total"] == 1
    assert get(q="5678")["total"] == 1
    assert get(q="ford")["total"] == 1
    assert get(q="%")["total"] == 0
    page = get(page=2, size=2)
    assert (len(page["items"]), page["total"], page["page"], page["size"]) == (1, 3, 2, 2)
    assert client.get(URL, params={"size": 101}, headers=header).status_code == 422
    assert client.get(URL, params={"page": 0}, headers=header).status_code == 422


def test_customer_vehicles_endpoint(client, auth_header):
    mechanic = auth_header(Role.MECHANIC)
    admin = auth_header()
    first = make_customer(client, admin)
    second = make_customer(client, admin, document="11144477735", name="Segundo")
    create(client, admin, first)
    create(client, admin, second, plate="DEF5678")

    body = client.get(f"{CUSTOMERS}/{first}/vehicles", headers=mechanic).json()

    assert body["total"] == 1
    assert body["items"][0]["plate"] == "ABC1234"
    assert client.get(f"{CUSTOMERS}/999/vehicles", headers=mechanic).status_code == 404


def test_mechanic_reads_but_cannot_write(client, auth_header):
    admin = auth_header()
    mechanic = auth_header(Role.MECHANIC)
    cid = make_customer(client, admin)
    vid = create(client, admin, cid).json()["id"]

    assert client.get(URL, headers=mechanic).status_code == 200
    assert client.get(f"{URL}/{vid}", headers=mechanic).status_code == 200
    assert create(client, mechanic, cid, plate="DEF5678").status_code == 403
    assert client.patch(f"{URL}/{vid}", json={"color": "x"}, headers=mechanic).status_code == 403
    assert client.delete(f"{URL}/{vid}", headers=mechanic).status_code == 403


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401
    assert client.get(f"{CUSTOMERS}/1/vehicles").status_code == 401


def test_audit_ids_from_acting_user(client, auth_header, db_session):
    from app.infrastructure.db.models.vehicle import VehicleModel

    header = auth_header(Role.RECEPTION)
    cid = make_customer(client, header)
    vid = create(client, header, cid).json()["id"]

    model = db_session.get(VehicleModel, vid)
    assert model.created_by_id is not None
    assert model.created_by_id == model.updated_by_id

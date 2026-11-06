import pytest

from app.domain.roles import Role
from app.infrastructure.repositories.km_repository import SqlKmReadingRepository
from app.infrastructure.repositories.vehicle_repository import SqlVehicleRepository

VEHICLES = "/api/v1/vehicles"
CUSTOMERS = "/api/v1/customers"


@pytest.fixture
def setup(client, auth_header):
    header = auth_header(Role.ADMIN)
    cid = client.post(
        CUSTOMERS, json={"name": "Cliente Ficticio", "document": "52998224725"}, headers=header
    ).json()["id"]
    vid = client.post(
        VEHICLES,
        json={
            "customer_id": cid, "plate": "ABC1234", "brand": "Fiat", "model": "Uno",
            "year": 2015, "fuel": "flex", "color": "Prata",
        },
        headers=header,
    ).json()["id"]
    return header, vid


def km_url(vid):
    return f"{VEHICLES}/{vid}/km"


def current_km(client, header, vid):
    return client.get(f"{VEHICLES}/{vid}", headers=header).json()["current_km"]


def test_increase_updates_current_km(client, setup):
    header, vid = setup
    response = client.post(km_url(vid), json={"km": 1000}, headers=header)

    assert response.status_code == 201
    body = response.json()
    assert body["km"] == 1000 and body["source"] == "manual" and body["vehicle_id"] == vid
    assert body["note"] is None
    assert current_km(client, header, vid) == 1000
    assert client.post(km_url(vid), json={"km": 1500}, headers=header).status_code == 201
    assert current_km(client, header, vid) == 1500


def test_decrease_blocked_422(client, setup):
    header, vid = setup
    client.post(km_url(vid), json={"km": 1000}, headers=header)

    response = client.post(km_url(vid), json={"km": 900}, headers=header)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "business_rule_violation"
    assert response.json()["error"]["message"] == "A quilometragem não pode diminuir"
    assert current_km(client, header, vid) == 1000


def test_equal_is_idempotent(client, setup):
    header, vid = setup
    first = client.post(km_url(vid), json={"km": 1000}, headers=header).json()

    again = client.post(km_url(vid), json={"km": 1000}, headers=header)

    assert again.status_code == 201
    assert again.json()["id"] == first["id"]
    assert client.get(km_url(vid), headers=header).json()["total"] == 1


def test_force_admin_with_note_decreases(client, setup):
    header, vid = setup
    client.post(km_url(vid), json={"km": 1000}, headers=header)

    response = client.post(
        km_url(vid),
        json={"km": 800, "force": True, "note": "Correção de digitação"},
        headers=header,
    )

    assert response.status_code == 201
    assert response.json()["note"] == "Correção de digitação"
    assert current_km(client, header, vid) == 800


@pytest.mark.parametrize("note", [None, "", "   "])
def test_force_requires_note(client, setup, note):
    header, vid = setup
    client.post(km_url(vid), json={"km": 1000}, headers=header)

    response = client.post(
        km_url(vid), json={"km": 800, "force": True, "note": note}, headers=header
    )

    assert response.status_code == 422
    assert current_km(client, header, vid) == 1000


@pytest.mark.parametrize("role", [Role.RECEPTION, Role.MECHANIC])
def test_force_only_admin(client, setup, auth_header, role):
    header, vid = setup
    client.post(km_url(vid), json={"km": 1000}, headers=header)

    response = client.post(
        km_url(vid), json={"km": 800, "force": True, "note": "x"}, headers=auth_header(role)
    )

    assert response.status_code == 403
    assert current_km(client, header, vid) == 1000


@pytest.mark.parametrize("role", [Role.RECEPTION, Role.MECHANIC])
def test_other_roles_can_register_and_all_can_read(client, setup, auth_header, role):
    _, vid = setup
    other = auth_header(role)

    assert client.post(km_url(vid), json={"km": 10}, headers=other).status_code == 201
    assert client.get(km_url(vid), headers=other).status_code == 200


def test_recorded_by_is_actor(client, setup, auth_header):
    _, vid = setup
    body = client.post(km_url(vid), json={"km": 10}, headers=auth_header(Role.MECHANIC)).json()
    assert body["recorded_by_id"] is not None


def test_history_paginated_most_recent_first(client, setup):
    header, vid = setup
    for km in (100, 200, 300):
        client.post(km_url(vid), json={"km": km}, headers=header)

    page1 = client.get(km_url(vid), params={"page": 1, "size": 2}, headers=header).json()
    page2 = client.get(km_url(vid), params={"page": 2, "size": 2}, headers=header).json()

    assert page1["total"] == 3 and page1["page"] == 1 and page1["size"] == 2
    assert [i["km"] for i in page1["items"]] == [300, 200]
    assert [i["km"] for i in page2["items"]] == [100]
    assert client.get(km_url(vid), params={"size": 101}, headers=header).status_code == 422
    assert client.get(km_url(vid), params={"page": 0}, headers=header).status_code == 422


def test_missing_and_deleted_vehicle_404(client, setup):
    header, vid = setup
    assert client.post(km_url(999), json={"km": 1}, headers=header).status_code == 404
    assert client.get(km_url(999), headers=header).status_code == 404
    client.delete(f"{VEHICLES}/{vid}", headers=header)
    assert client.post(km_url(vid), json={"km": 1}, headers=header).status_code == 404
    assert client.get(km_url(vid), headers=header).status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"km": -1},
        {"km": 5_000_001},
        {"km": "abc"},
        {},
        {"km": 1.5},
        {"km": 1, "source": "checkin"},
        {"km": 1, "note": "x" * 501},
        {"km": 1, "force": "talvez"},
    ],
)
def test_validation_422(client, setup, payload):
    header, vid = setup
    assert client.post(km_url(vid), json=payload, headers=header).status_code == 422


def test_requires_auth(client, setup):
    _, vid = setup
    assert client.post(km_url(vid), json={"km": 1}).status_code == 401
    assert client.get(km_url(vid)).status_code == 401


def test_failure_after_insert_rolls_back_reading_and_current_km(client, setup, monkeypatch):
    header, vid = setup
    client.post(km_url(vid), json={"km": 1000}, headers=header)

    def boom(self, vehicle_id, km, *, actor_id):
        raise RuntimeError("falha forçada")

    # A leitura já foi inserida (add) quando o update de current_km falha.
    monkeypatch.setattr(SqlVehicleRepository, "update_current_km", boom)
    with pytest.raises(RuntimeError):
        client.post(km_url(vid), json={"km": 2000}, headers=header)
    monkeypatch.undo()

    assert current_km(client, header, vid) == 1000
    history = client.get(km_url(vid), headers=header).json()
    assert history["total"] == 1 and history["items"][0]["km"] == 1000


def test_failure_on_insert_leaves_current_km(client, setup, monkeypatch):
    header, vid = setup

    def boom(self, reading):
        raise RuntimeError("falha forçada")

    monkeypatch.setattr(SqlKmReadingRepository, "add", boom)
    with pytest.raises(RuntimeError):
        client.post(km_url(vid), json={"km": 50}, headers=header)
    monkeypatch.undo()
    assert current_km(client, header, vid) == 0

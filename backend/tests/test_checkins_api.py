from datetime import datetime, timedelta

import pytest
from sqlalchemy import select, update

from app.domain.checkin import ChecklistItem
from app.domain.roles import Role
from app.infrastructure.db.models.checkin import (
    CheckinChecklistItemModel,
    CheckinModel,
    CheckinPhotoModel,
)

VEHICLES = "/api/v1/vehicles"
CUSTOMERS = "/api/v1/customers"
CHECKINS = "/api/v1/checkins"


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


def checklist(**overrides):
    return [
        {"item": item.value, "condition": overrides.get(item.value, "ok")}
        for item in ChecklistItem
    ]


def payload(vid, **overrides):
    body = {
        "vehicle_id": vid, "km": 1000, "fuel_level": "meio",
        "damages": "Arranhão leve na porta", "checklist": checklist(),
    }
    body.update(overrides)
    return body


def make_checkin(client, header, vid, **overrides):
    response = client.post(CHECKINS, json=payload(vid, **overrides), headers=header)
    assert response.status_code == 201, response.text
    return response.json()


def current_km(client, header, vid):
    return client.get(f"{VEHICLES}/{vid}", headers=header).json()["current_km"]


def presign(client, header, cid, content_type="image/jpeg", size=1000):
    return client.post(
        f"{CHECKINS}/{cid}/photos/presign",
        json={"content_type": content_type, "size_bytes": size},
        headers=header,
    )


def upload_and_confirm(client, header, storage, cid, content_type="image/jpeg", data=b"x" * 10):
    body = presign(client, header, cid, content_type, len(data)).json()
    key = storage.presign_uploads[-1]["key"]
    storage.put(key, data, content_type)
    response = client.post(
        f"{CHECKINS}/{cid}/photos/{body['photo_id']}/confirm", headers=header
    )
    return body["photo_id"], key, response


# ---- criação -----------------------------------------------------------------------------


def test_create_with_seven_items_updates_km_and_audit(client, setup):
    header, vid = setup
    body = make_checkin(client, header, vid, km=1500)

    assert body["vehicle_id"] == vid and body["km"] == 1500 and body["fuel_level"] == "meio"
    assert len(body["checklist"]) == 7
    assert body["photos"] == []
    assert body["created_by_id"] == body["user_id"]
    assert current_km(client, header, vid) == 1500
    history = client.get(f"{VEHICLES}/{vid}/km", headers=header).json()
    assert history["total"] == 1 and history["items"][0]["source"] == "checkin"


def test_equal_km_is_accepted_without_new_reading(client, setup):
    header, vid = setup
    client.post(f"{VEHICLES}/{vid}/km", json={"km": 1000}, headers=header)

    make_checkin(client, header, vid, km=1000)

    assert client.get(f"{VEHICLES}/{vid}/km", headers=header).json()["total"] == 1


def test_lower_km_blocks_whole_checkin(client, setup, db_session):
    header, vid = setup
    client.post(f"{VEHICLES}/{vid}/km", json={"km": 2000}, headers=header)

    response = client.post(CHECKINS, json=payload(vid, km=1500), headers=header)

    assert response.status_code == 422
    assert response.json()["error"]["message"] == "A quilometragem não pode diminuir"
    assert current_km(client, header, vid) == 2000
    assert db_session.scalars(select(CheckinModel)).all() == []
    assert db_session.scalars(select(CheckinChecklistItemModel)).all() == []
    assert client.get(CHECKINS, headers=header).json()["total"] == 0


def test_missing_checklist_item_422(client, setup):
    header, vid = setup
    response = client.post(
        CHECKINS, json=payload(vid, checklist=checklist()[:-1]), headers=header
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "business_rule_violation"
    assert current_km(client, header, vid) == 0


def test_duplicate_checklist_item_422(client, setup):
    header, vid = setup
    items = checklist()
    items[-1] = dict(items[0])
    response = client.post(CHECKINS, json=payload(vid, checklist=items), headers=header)

    assert response.status_code == 422
    assert client.get(CHECKINS, headers=header).json()["total"] == 0


def test_unknown_or_extra_checklist_item_422(client, setup):
    header, vid = setup
    unknown = checklist()
    unknown[0] = {"item": "motor", "condition": "ok"}
    assert client.post(
        CHECKINS, json=payload(vid, checklist=unknown), headers=header
    ).status_code == 422
    eight = checklist() + [{"item": "pneus", "condition": "ok"}]
    assert client.post(
        CHECKINS, json=payload(vid, checklist=eight), headers=header
    ).status_code == 422


@pytest.mark.parametrize(
    "override",
    [
        {"fuel_level": "reserva"},
        {"km": -1},
        {"km": 5_000_001},
        {"km": "10"},
        {"user_id": 1},
        {"damages": "x" * 2001},
    ],
)
def test_invalid_fields_422(client, setup, override):
    header, vid = setup
    assert client.post(
        CHECKINS, json=payload(vid, **override), headers=header
    ).status_code == 422


def test_invalid_condition_422(client, setup):
    header, vid = setup
    assert client.post(
        CHECKINS, json=payload(vid, checklist=checklist(pneus="pessimo")), headers=header
    ).status_code == 422


def test_unknown_vehicle_404(client, setup):
    header, _ = setup
    assert client.post(CHECKINS, json=payload(9999), headers=header).status_code == 404


def test_deleted_vehicle_404(client, setup):
    header, vid = setup
    client.delete(f"{VEHICLES}/{vid}", headers=header)
    assert client.post(CHECKINS, json=payload(vid), headers=header).status_code == 404


def test_reception_creates_and_mechanic_403(client, setup, auth_header):
    header, vid = setup
    assert client.post(
        CHECKINS, json=payload(vid), headers=auth_header(Role.RECEPTION)
    ).status_code == 201
    mech = auth_header(Role.MECHANIC)
    assert client.post(CHECKINS, json=payload(vid, km=2000), headers=mech).status_code == 403
    assert current_km(client, header, vid) == 1000


def test_unauthenticated_401(client, setup):
    _, vid = setup
    assert client.post(CHECKINS, json=payload(vid)).status_code == 401
    assert client.get(CHECKINS).status_code == 401
    assert client.get(f"{CHECKINS}/1").status_code == 401


# ---- leitura -----------------------------------------------------------------------------


def test_get_detail_with_checklist_and_mechanic_can_read(client, setup, auth_header):
    header, vid = setup
    created = make_checkin(client, header, vid, checklist=checklist(freios="critico"))

    response = client.get(f"{CHECKINS}/{created['id']}", headers=auth_header(Role.MECHANIC))

    assert response.status_code == 200
    items = {i["item"]: i["condition"] for i in response.json()["checklist"]}
    assert items["freios"] == "critico" and len(items) == 7


def test_get_404(client, setup):
    header, _ = setup
    assert client.get(f"{CHECKINS}/9999", headers=header).status_code == 404


def test_list_pagination_and_vehicle_filter(client, setup):
    header, vid = setup
    other = client.post(
        VEHICLES,
        json={
            "customer_id": client.get(f"{VEHICLES}/{vid}", headers=header).json()["customer"]["id"],
            "plate": "XYZ9A87", "brand": "VW", "model": "Gol", "year": 2018,
            "fuel": "flex", "color": "Azul",
        },
        headers=header,
    ).json()["id"]
    for km in (100, 200, 300):
        make_checkin(client, header, vid, km=km)
    make_checkin(client, header, other, km=50)

    page = client.get(CHECKINS, params={"page": 1, "size": 2}, headers=header).json()
    assert page["total"] == 4 and len(page["items"]) == 2 and "checklist" not in page["items"][0]
    filtered = client.get(CHECKINS, params={"vehicle_id": vid}, headers=header).json()
    assert filtered["total"] == 3
    assert [c["km"] for c in filtered["items"]] == [300, 200, 100]
    assert client.get(CHECKINS, params={"size": 101}, headers=header).status_code == 422
    assert client.get(CHECKINS, params={"page": 0}, headers=header).status_code == 422


# ---- fotos -------------------------------------------------------------------------------


def test_presign_returns_upload_instructions(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]

    response = presign(client, header, cid, "image/png", 2048)

    assert response.status_code == 201
    body = response.json()
    assert body["expires_in"] == 900
    assert body["upload"]["url"] == "https://fake-bucket.example/"
    assert body["upload"]["method"] == "POST"
    call = storage.presign_uploads[0]
    assert call["content_type"] == "image/png"
    assert call["max_bytes"] == 8 * 1024 * 1024
    assert call["expires_in"] == 900
    assert call["key"].startswith(f"checkins/{cid}/") and call["key"].endswith(".png")
    assert body["upload"]["fields"]["key"] == call["key"]


def test_presign_keys_are_unique_uuids(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    presign(client, header, cid)
    presign(client, header, cid)

    keys = [c["key"] for c in storage.presign_uploads]
    assert len(set(keys)) == 2
    assert all(k.endswith(".jpg") for k in keys)


@pytest.mark.parametrize(
    ("content_type", "size"),
    [
        ("image/gif", 100),
        ("application/pdf", 100),
        ("image/jpeg", 8 * 1024 * 1024 + 1),
        ("image/jpeg", 0),
        ("image/jpeg", -5),
    ],
)
def test_presign_rejects_invalid_type_or_size(client, setup, storage, content_type, size):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]

    assert presign(client, header, cid, content_type, size).status_code == 422
    assert storage.presign_uploads == []


def test_presign_accepts_exactly_8mb(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    assert presign(client, header, cid, "image/webp", 8 * 1024 * 1024).status_code == 201


def test_photo_limit_counts_pending_and_confirmed(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    for _ in range(4):
        upload_and_confirm(client, header, storage, cid)
    for _ in range(6):
        assert presign(client, header, cid).status_code == 201

    response = presign(client, header, cid)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "business_rule_violation"
    assert len(storage.presign_uploads) == 10


def test_expired_pending_presigns_do_not_count(client, setup, storage, db_session):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    for _ in range(10):
        assert presign(client, header, cid).status_code == 201
    assert presign(client, header, cid).status_code == 422
    db_session.execute(
        update(CheckinPhotoModel).values(created_at=datetime.now() - timedelta(hours=2))
    )
    db_session.commit()

    assert presign(client, header, cid).status_code == 201


def test_presign_unknown_checkin_404_and_mechanic_403(client, setup, storage, auth_header):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]

    assert presign(client, header, 9999).status_code == 404
    assert presign(client, auth_header(Role.MECHANIC), cid).status_code == 403
    assert presign(client, {}, cid).status_code == 401


def test_confirm_requires_uploaded_object(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    photo_id = presign(client, header, cid).json()["photo_id"]

    response = client.post(f"{CHECKINS}/{cid}/photos/{photo_id}/confirm", headers=header)

    assert response.status_code == 422
    detail = client.get(f"{CHECKINS}/{cid}", headers=header).json()
    assert detail["photos"][0]["status"] == "pending"
    assert detail["photos"][0]["download_url"] is None


def test_confirm_marks_photo_and_download_url_expires_in_15_min(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]

    photo_id, key, response = upload_and_confirm(client, header, storage, cid, data=b"y" * 33)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "confirmed" and body["size_bytes"] == 33
    assert body["download_url"] == f"https://fake-bucket.example/{key}?expires_in=900"
    detail = client.get(f"{CHECKINS}/{cid}", headers=header).json()
    assert detail["download_expires_in"] == 900
    assert [p["id"] for p in detail["photos"]] == [photo_id]
    assert detail["photos"][0]["download_url"].endswith("expires_in=900")
    assert storage.presign_downloads[-1] == {"key": key, "expires_in": 900}


def test_download_url_only_for_confirmed_photos(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    confirmed_id, _, _ = upload_and_confirm(client, header, storage, cid)
    pending_id = presign(client, header, cid).json()["photo_id"]
    storage.presign_downloads.clear()

    photos = {
        p["id"]: p for p in client.get(f"{CHECKINS}/{cid}", headers=header).json()["photos"]
    }

    assert photos[confirmed_id]["download_url"] is not None
    assert photos[pending_id]["download_url"] is None
    assert photos[pending_id]["status"] == "pending"
    assert len(storage.presign_downloads) == 1


def test_stale_pending_photo_is_hidden(client, setup, storage, db_session):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    presign(client, header, cid)
    db_session.execute(
        update(CheckinPhotoModel).values(created_at=datetime.now() - timedelta(hours=2))
    )
    db_session.commit()

    assert client.get(f"{CHECKINS}/{cid}", headers=header).json()["photos"] == []


def test_confirm_rejects_wrong_type_or_oversize_and_discards_object(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    photo_id = presign(client, header, cid, "image/jpeg").json()["photo_id"]
    key = storage.presign_uploads[-1]["key"]
    storage.put(key, b"x", "image/png")  # tipo diferente do combinado

    response = client.post(f"{CHECKINS}/{cid}/photos/{photo_id}/confirm", headers=header)

    assert response.status_code == 422
    assert key in storage.deleted and not storage.exists(key)
    assert client.get(f"{CHECKINS}/{cid}", headers=header).json()["photos"] == []


def test_confirm_is_idempotent(client, setup, storage):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    photo_id, _, _ = upload_and_confirm(client, header, storage, cid)

    again = client.post(f"{CHECKINS}/{cid}/photos/{photo_id}/confirm", headers=header)

    assert again.status_code == 200 and again.json()["status"] == "confirmed"


def test_confirm_404_wrong_checkin_and_permissions(client, setup, storage, auth_header):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    other = make_checkin(client, header, vid, km=2000)["id"]
    photo_id = presign(client, header, cid).json()["photo_id"]

    assert client.post(f"{CHECKINS}/{cid}/photos/9999/confirm", headers=header).status_code == 404
    assert client.post(
        f"{CHECKINS}/{other}/photos/{photo_id}/confirm", headers=header
    ).status_code == 404
    assert client.post(
        f"{CHECKINS}/9999/photos/{photo_id}/confirm", headers=header
    ).status_code == 404
    assert client.post(
        f"{CHECKINS}/{cid}/photos/{photo_id}/confirm", headers=auth_header(Role.MECHANIC)
    ).status_code == 403


def test_delete_removes_object_and_row(client, setup, storage, db_session):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    photo_id, key, _ = upload_and_confirm(client, header, storage, cid)

    response = client.delete(f"{CHECKINS}/{cid}/photos/{photo_id}", headers=header)

    assert response.status_code == 204 and response.content == b""
    assert key in storage.deleted and not storage.exists(key)
    assert db_session.scalars(select(CheckinPhotoModel)).all() == []
    assert client.get(f"{CHECKINS}/{cid}", headers=header).json()["photos"] == []
    assert client.delete(f"{CHECKINS}/{cid}/photos/{photo_id}", headers=header).status_code == 404


def test_delete_permissions_and_404(client, setup, storage, auth_header):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    photo_id, key, _ = upload_and_confirm(client, header, storage, cid)

    assert client.delete(
        f"{CHECKINS}/{cid}/photos/{photo_id}", headers=auth_header(Role.MECHANIC)
    ).status_code == 403
    assert storage.exists(key)
    assert client.delete(f"{CHECKINS}/9999/photos/{photo_id}", headers=header).status_code == 404
    assert client.delete(
        f"{CHECKINS}/{cid}/photos/{photo_id}", headers=auth_header(Role.RECEPTION)
    ).status_code == 204


def test_failed_storage_delete_keeps_row(client, setup, storage, db_session):
    header, vid = setup
    cid = make_checkin(client, header, vid)["id"]
    photo_id, _, _ = upload_and_confirm(client, header, storage, cid)

    def boom(key):
        raise RuntimeError("s3 fora do ar")

    storage.delete = boom
    with pytest.raises(RuntimeError):
        client.delete(f"{CHECKINS}/{cid}/photos/{photo_id}", headers=header)

    assert len(db_session.scalars(select(CheckinPhotoModel)).all()) == 1

from decimal import Decimal

import pytest
from sqlalchemy import select

from app.domain.checkin import ChecklistItem
from app.domain.roles import Role
from app.infrastructure.db.models.service_order import ServiceOrderStatusHistoryModel
from tests.conftest import PASSWORD

OS = "/api/v1/service-orders"
VEHICLES = "/api/v1/vehicles"
CUSTOMERS = "/api/v1/customers"
CHECKINS = "/api/v1/checkins"

DOCS = ["52998224725", "11144477735", "39053344705", "11222333000181"]
PLATES = ["ABC1234", "BCD2345", "CDE3456", "DEF4567", "EFG5678"]


class Ctx:
    """Contexto de teste: cabeçalhos por perfil e mecânicos com id conhecido."""

    def __init__(self, client, make_user, auth_header):
        self.client = client
        self._docs = iter(DOCS)
        self._plates = iter(PLATES)
        self.make_user = make_user
        self.admin = auth_header(Role.ADMIN)
        self.reception = auth_header(Role.RECEPTION)
        self.mech_user, self.mech = self.login_as(Role.MECHANIC, name="Mecânico Um")
        self.mech2_user, self.mech2 = self.login_as(Role.MECHANIC, name="Mecânico Dois")

    def login_as(self, role, **kw):
        user = self.make_user(role=role, **kw)
        r = self.client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
        return user, {"Authorization": f"Bearer {r.json()['access_token']}"}

    def vehicle(self, customer_name="Cliente Ficticio"):
        cid = self.client.post(
            CUSTOMERS,
            json={"name": customer_name, "document": next(self._docs)},
            headers=self.admin,
        ).json()["id"]
        r = self.client.post(
            VEHICLES,
            json={
                "customer_id": cid, "plate": next(self._plates), "brand": "Fiat", "model": "Uno",
                "year": 2015, "fuel": "flex", "color": "Prata",
            },
            headers=self.admin,
        )
        return r.json()["id"]

    def order(self, vid, header=None, **kw):
        body = {"vehicle_id": vid, "reported_issue": "Barulho na suspensão", **kw}
        r = self.client.post(OS, json=body, headers=header or self.reception)
        assert r.status_code == 201, r.text
        return r.json()

    def move(self, oid, to, header=None):
        return self.client.post(f"{OS}/{oid}/status", json={"to": to}, headers=header or self.admin)

    def advance(self, oid, to):
        path = [
            "aguardando_orcamento", "aguardando_aprovacao", "em_execucao", "finalizada",
            "entregue",
        ]
        for status in path[: path.index(to) + 1]:
            r = self.move(oid, status)
            assert r.status_code == 200, r.text

    def item(self, oid, header=None, **kw):
        body = {
            "kind": "service", "description": "Troca de óleo", "qty": "1", "unit_price": "100.00"
        }
        body.update(kw)
        return self.client.post(f"{OS}/{oid}/items", json=body, headers=header or self.reception)


@pytest.fixture
def ctx(client, make_user, auth_header):
    return Ctx(client, make_user, auth_header)


@pytest.fixture
def vid(ctx):
    return ctx.vehicle()


# ---- criação, número e histórico -----------------------------------------------------------


def test_create_returns_detail_with_number_status_and_history(ctx, vid):
    body = ctx.order(vid, labor_cost="150.50", due_date="2026-12-01", mechanic_id=ctx.mech_user.id)
    assert body["number"] == "OS-000001"
    assert body["status"] == "aberta"
    assert body["labor_cost"] == "150.50"
    assert body["total"] == "150.50"
    assert body["items"] == []
    assert body["vehicle"]["plate"] == "ABC1234"
    assert body["customer"]["name"] == "Cliente Ficticio"
    assert body["mechanic"] == {"id": ctx.mech_user.id, "name": "Mecânico Um"}
    assert len(body["history"]) == 1
    assert body["history"][0]["from_status"] is None
    assert body["history"][0]["to_status"] == "aberta"


def test_numbers_are_sequential_and_unique(ctx, vid):
    numbers = [ctx.order(vid)["number"] for _ in range(5)]
    assert numbers == [f"OS-{i:06d}" for i in range(1, 6)]


def test_number_is_not_reused_after_soft_delete(ctx, vid):
    first = ctx.order(vid)
    assert ctx.client.delete(f"{OS}/{first['id']}", headers=ctx.admin).status_code == 204
    assert ctx.order(vid)["number"] == "OS-000002"


def test_create_by_admin_works(ctx, vid):
    r = ctx.client.post(
        OS, json={"vehicle_id": vid, "reported_issue": "Freio"}, headers=ctx.admin
    )
    assert r.status_code == 201
    assert r.json()["labor_cost"] == "0.00"


def test_create_audit_fields(ctx, vid, db_session):
    from app.infrastructure.db.models.service_order import ServiceOrderModel

    ctx.order(vid)
    model = db_session.scalar(select(ServiceOrderModel))
    assert model.created_by_id is not None
    assert model.updated_by_id == model.created_by_id


def test_mechanic_cannot_create(ctx, vid):
    r = ctx.client.post(
        OS, json={"vehicle_id": vid, "reported_issue": "x"}, headers=ctx.mech
    )
    assert r.status_code == 403


def test_create_unknown_vehicle_404(ctx):
    r = ctx.client.post(OS, json={"vehicle_id": 999, "reported_issue": "x"}, headers=ctx.admin)
    assert r.status_code == 404


def test_create_with_deleted_vehicle_404(ctx, vid):
    ctx.client.delete(f"{VEHICLES}/{vid}", headers=ctx.admin)
    r = ctx.client.post(OS, json={"vehicle_id": vid, "reported_issue": "x"}, headers=ctx.admin)
    assert r.status_code == 404


def test_create_validation(ctx, vid):
    for body in (
        {"vehicle_id": vid},
        {"vehicle_id": vid, "reported_issue": "   "},
        {"vehicle_id": 0, "reported_issue": "x"},
        {"vehicle_id": vid, "reported_issue": "x", "total": "10.00"},
        {"vehicle_id": vid, "reported_issue": "x", "status": "entregue"},
        {"vehicle_id": vid, "reported_issue": "x", "due_date": "not-a-date"},
    ):
        assert ctx.client.post(OS, json=body, headers=ctx.admin).status_code == 422, body


# ---- mecânico / check-in na criação ------------------------------------------------------------


def test_mechanic_id_must_be_active_mechanic(ctx, vid, make_user):
    inactive = make_user(role=Role.MECHANIC, active=False)
    reception_user = make_user(role=Role.RECEPTION)
    for mid in (inactive.id, reception_user.id, 9999):
        r = ctx.client.post(
            OS,
            json={"vehicle_id": vid, "reported_issue": "x", "mechanic_id": mid},
            headers=ctx.admin,
        )
        assert r.status_code == 422, mid
        assert r.json()["error"]["code"] == "business_rule_violation"
    order = ctx.order(vid)
    r = ctx.client.patch(
        f"{OS}/{order['id']}", json={"mechanic_id": inactive.id}, headers=ctx.admin
    )
    assert r.status_code == 422


def test_checkin_must_belong_to_same_vehicle(ctx, vid):
    other_vid = ctx.vehicle()
    items = [{"item": i.value, "condition": "ok"} for i in ChecklistItem]
    checkin = ctx.client.post(
        CHECKINS,
        json={"vehicle_id": vid, "km": 10, "fuel_level": "meio", "checklist": items},
        headers=ctx.admin,
    )
    assert checkin.status_code == 201, checkin.text
    cid = checkin.json()["id"]
    ok = ctx.order(vid, checkin_id=cid)
    assert ok["checkin_id"] == cid
    r = ctx.client.post(
        OS, json={"vehicle_id": other_vid, "reported_issue": "x", "checkin_id": cid},
        headers=ctx.admin,
    )
    assert r.status_code == 422
    r = ctx.client.post(
        OS, json={"vehicle_id": vid, "reported_issue": "x", "checkin_id": 9999}, headers=ctx.admin
    )
    assert r.status_code == 404


# ---- máquina de estados via API, permissões e histórico ----------------------------------------


def test_happy_path_records_full_history(ctx, vid):
    oid = ctx.order(vid, mechanic_id=ctx.mech_user.id)["id"]
    for to, header in (
        ("aguardando_orcamento", ctx.reception),
        ("aguardando_aprovacao", ctx.reception),
        ("em_execucao", ctx.reception),
        ("finalizada", ctx.mech),
        ("entregue", ctx.reception),
    ):
        r = ctx.move(oid, to, header)
        assert r.status_code == 200, (to, r.text)
        assert r.json()["status"] == to
    detail = ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).json()
    assert [(h["from_status"], h["to_status"]) for h in detail["history"]] == [
        (None, "aberta"),
        ("aberta", "aguardando_orcamento"),
        ("aguardando_orcamento", "aguardando_aprovacao"),
        ("aguardando_aprovacao", "em_execucao"),
        ("em_execucao", "finalizada"),
        ("finalizada", "entregue"),
    ]
    assert detail["history"][4]["changed_by_id"] == ctx.mech_user.id


def test_quote_refused_returns_to_awaiting_quote(ctx, vid):
    oid = ctx.order(vid)["id"]
    ctx.advance(oid, "aguardando_aprovacao")
    r = ctx.move(oid, "aguardando_orcamento", ctx.reception)
    assert r.status_code == 200
    assert r.json()["history"][-1]["from_status"] == "aguardando_aprovacao"


def test_invalid_transition_422_lists_allowed(ctx, vid):
    oid = ctx.order(vid)["id"]
    r = ctx.move(oid, "entregue")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "business_rule_violation"
    assert "aguardando_orcamento" in r.json()["error"]["message"]
    r = ctx.move(oid, "aberta")  # mesma situação
    assert r.status_code == 422
    # estado inalterado e sem histórico novo
    detail = ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).json()
    assert detail["status"] == "aberta"
    assert len(detail["history"]) == 1


def test_unknown_status_value_422(ctx, vid):
    oid = ctx.order(vid)["id"]
    assert ctx.move(oid, "inexistente").status_code == 422


def test_transition_permissions_by_role(ctx, vid):
    oid = ctx.order(vid, mechanic_id=ctx.mech_user.id)["id"]
    # mecânico não faz transições de balcão
    assert ctx.move(oid, "aguardando_orcamento", ctx.mech).status_code == 403
    ctx.advance(oid, "em_execucao")
    # recepção não finaliza; mecânico de outra OS nem a enxerga (404)
    assert ctx.move(oid, "finalizada", ctx.reception).status_code == 403
    assert ctx.move(oid, "finalizada", ctx.mech2).status_code == 404
    assert ctx.move(oid, "finalizada", ctx.mech).status_code == 200
    # mecânico não entrega
    assert ctx.move(oid, "entregue", ctx.mech).status_code == 403
    assert ctx.move(oid, "entregue", ctx.reception).status_code == 200


def test_admin_can_finish_without_mechanic(ctx, vid):
    oid = ctx.order(vid)["id"]
    ctx.advance(oid, "finalizada")


def test_failed_transition_does_not_write_history(ctx, vid, db_session):
    oid = ctx.order(vid)["id"]
    ctx.move(oid, "entregue")
    ctx.move(oid, "aguardando_orcamento", ctx.mech)
    count = db_session.scalars(select(ServiceOrderStatusHistoryModel)).all()
    assert len(count) == 1


# ---- itens e total -----------------------------------------------------------------------------


def test_total_is_computed_server_side(ctx, vid):
    oid = ctx.order(vid, labor_cost="50.00")["id"]
    r = ctx.item(oid, qty="2", unit_price="10.50")
    assert r.status_code == 201
    body = r.json()
    assert body["total"] == "71.00"
    assert body["items"][0]["line_total"] == "21.00"
    assert body["items"][0]["qty"] == "2.000"
    assert body["items"][0]["unit_price"] == "10.50"
    r = ctx.item(oid, kind="part", description="Filtro", qty="1.5", unit_price="19.99")
    assert r.json()["total"] == "100.99"  # 50 + 21 + 29.985 -> 29.99


def test_rounding_half_up_with_three_decimal_qty(ctx, vid):
    oid = ctx.order(vid)["id"]
    assert ctx.item(oid, qty="1.005", unit_price="1.00").json()["total"] == "1.01"
    assert ctx.item(oid, qty="0.333", unit_price="10.00").json()["total"] == "4.34"
    assert ctx.item(oid, qty="3", unit_price="19.99").json()["total"] == "64.31"


def test_client_cannot_send_total(ctx, vid):
    oid = ctx.order(vid)["id"]
    assert ctx.item(oid, total="1.00").status_code == 422
    r = ctx.client.patch(f"{OS}/{oid}", json={"total": "1.00"}, headers=ctx.admin)
    assert r.status_code == 422


def test_labor_cost_patch_recalculates(ctx, vid):
    oid = ctx.order(vid, labor_cost="10.00")["id"]
    ctx.item(oid, qty="1", unit_price="5.00")
    r = ctx.client.patch(f"{OS}/{oid}", json={"labor_cost": "20.005"}, headers=ctx.admin)
    assert r.status_code == 422
    r = ctx.client.patch(f"{OS}/{oid}", json={"labor_cost": 20.5}, headers=ctx.admin)
    assert r.status_code == 200
    assert r.json()["labor_cost"] == "20.50"
    assert r.json()["total"] == "25.50"


def test_update_and_delete_item_recalculate(ctx, vid):
    oid = ctx.order(vid)["id"]
    ctx.item(oid, qty="2", unit_price="10.00")
    detail = ctx.item(oid, kind="part", description="Vela", qty="4", unit_price="25.00").json()
    assert detail["total"] == "120.00"
    first, second = detail["items"][0]["id"], detail["items"][1]["id"]
    r = ctx.client.patch(
        f"{OS}/{oid}/items/{first}", json={"qty": "3", "rule_code": "troca_oleo"},
        headers=ctx.reception,
    )
    assert r.status_code == 200
    assert r.json()["total"] == "130.00"
    assert r.json()["items"][0]["rule_code"] == "troca_oleo"
    r = ctx.client.delete(f"{OS}/{oid}/items/{second}", headers=ctx.reception)
    assert r.status_code == 204
    assert ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).json()["total"] == "30.00"


def test_item_404s(ctx, vid):
    oid = ctx.order(vid)["id"]
    other = ctx.order(vid)["id"]
    item_id = ctx.item(other).json()["items"][0]["id"]
    assert ctx.client.patch(
        f"{OS}/{oid}/items/{item_id}", json={"qty": "2"}, headers=ctx.admin
    ).status_code == 404
    assert ctx.client.delete(f"{OS}/{oid}/items/{item_id}", headers=ctx.admin).status_code == 404
    assert ctx.item(9999).status_code == 404


@pytest.mark.parametrize("final", ["finalizada", "entregue"])
def test_items_blocked_after_finished(ctx, vid, final):
    oid = ctx.order(vid)["id"]
    item_id = ctx.item(oid).json()["items"][0]["id"]
    ctx.advance(oid, final)
    assert ctx.item(oid, header=ctx.admin).status_code == 422
    r = ctx.client.patch(f"{OS}/{oid}/items/{item_id}", json={"qty": "2"}, headers=ctx.admin)
    assert r.status_code == 422
    assert ctx.client.delete(f"{OS}/{oid}/items/{item_id}", headers=ctx.admin).status_code == 422
    assert ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).json()["total"] == "100.00"


@pytest.mark.parametrize(
    "overrides",
    [
        {"qty": "0"},
        {"qty": "-1"},
        {"qty": "1.0005"},
        {"qty": "10000"},
        {"qty": "abc"},
        {"unit_price": "-0.01"},
        {"unit_price": "10.001"},
        {"unit_price": "1000000.00"},
        {"unit_price": "99999999999"},
        {"kind": "outro"},
        {"description": "  "},
        {"description": "x" * 201},
        {"rule_code": "Troca-Oleo"},
        {"rule_code": ""},
        {"rule_code": "x" * 41},
    ],
)
def test_item_money_and_field_validation(ctx, vid, overrides):
    oid = ctx.order(vid)["id"]
    assert ctx.item(oid, **overrides).status_code == 422


def test_item_accepts_json_numbers_and_rule_code(ctx, vid):
    oid = ctx.order(vid)["id"]
    r = ctx.client.post(
        f"{OS}/{oid}/items",
        json={"kind": "service", "description": "Alinhamento", "qty": 1, "unit_price": 80.5,
              "rule_code": "alinhamento_balanceamento"},
        headers=ctx.admin,
    )
    assert r.status_code == 201
    assert r.json()["items"][0]["rule_code"] == "alinhamento_balanceamento"
    assert r.json()["total"] == "80.50"


def test_labor_cost_validation(ctx, vid):
    for bad in ("-1", "1.234", "1000000", "abc"):
        r = ctx.client.post(
            OS, json={"vehicle_id": vid, "reported_issue": "x", "labor_cost": bad},
            headers=ctx.admin,
        )
        assert r.status_code == 422, bad


def test_total_overflow_is_422(ctx, vid):
    oid = ctx.order(vid)["id"]
    big = {"qty": "9999.999", "unit_price": "999999.99"}
    r = ctx.item(oid, **big)
    assert r.status_code == 422
    assert ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).json()["items"] == []


def test_item_count_limit(ctx, vid):
    oid = ctx.order(vid)["id"]
    for _ in range(200):
        assert ctx.item(oid, unit_price="0.01").status_code == 201
    assert ctx.item(oid).status_code == 422


def test_total_matches_decimal_sum(ctx, vid):
    oid = ctx.order(vid, labor_cost="12.34")["id"]
    expected = Decimal("12.34")
    for qty, price in (("1.250", "9.99"), ("0.5", "3.33"), ("7", "0.10")):
        body = ctx.item(oid, qty=qty, unit_price=price).json()
        expected += (Decimal(qty) * Decimal(price)).quantize(Decimal("0.01"), "ROUND_HALF_UP")
        assert Decimal(body["total"]) == expected


# ---- PATCH com limites por perfil --------------------------------------------------------------


def test_reception_patch_fields(ctx, vid):
    oid = ctx.order(vid)["id"]
    r = ctx.client.patch(
        f"{OS}/{oid}",
        json={"reported_issue": "Novo relato", "diagnosis": " Pastilhas ", "due_date": "2026-12-10",
              "mechanic_id": ctx.mech_user.id},
        headers=ctx.reception,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["reported_issue"] == "Novo relato"
    assert body["diagnosis"] == "Pastilhas"
    assert body["due_date"] == "2026-12-10"
    assert body["mechanic"]["id"] == ctx.mech_user.id
    r = ctx.client.patch(
        f"{OS}/{oid}", json={"diagnosis": None, "mechanic_id": None, "due_date": None},
        headers=ctx.admin,
    )
    assert r.json()["diagnosis"] is None and r.json()["mechanic"] is None
    for bad in ({"reported_issue": None}, {"labor_cost": None}, {"reported_issue": " "}):
        assert ctx.client.patch(f"{OS}/{oid}", json=bad, headers=ctx.admin).status_code == 422


def test_mechanic_can_only_edit_diagnosis_on_own_order(ctx, vid):
    oid = ctx.order(vid, mechanic_id=ctx.mech_user.id)["id"]
    r = ctx.client.patch(f"{OS}/{oid}", json={"diagnosis": "Folga na bucha"}, headers=ctx.mech)
    assert r.status_code == 200
    assert r.json()["diagnosis"] == "Folga na bucha"
    for body in (
        {"labor_cost": "1.00"},
        {"mechanic_id": ctx.mech2_user.id},
        {"reported_issue": "x"},
        {"due_date": "2026-12-01"},
        {"diagnosis": "ok", "labor_cost": "1.00"},
    ):
        r = ctx.client.patch(f"{OS}/{oid}", json=body, headers=ctx.mech)
        assert r.status_code == 403, body
    r = ctx.client.patch(f"{OS}/{oid}", json={"diagnosis": "x"}, headers=ctx.mech2)
    assert r.status_code == 404


def test_mechanic_manages_items_only_on_own_order(ctx, vid):
    oid = ctx.order(vid, mechanic_id=ctx.mech_user.id)["id"]
    r = ctx.item(oid, header=ctx.mech)
    assert r.status_code == 201
    item_id = r.json()["items"][0]["id"]
    assert ctx.client.patch(
        f"{OS}/{oid}/items/{item_id}", json={"qty": "2"}, headers=ctx.mech
    ).status_code == 200
    assert ctx.item(oid, header=ctx.mech2).status_code == 404
    assert ctx.client.delete(f"{OS}/{oid}/items/{item_id}", headers=ctx.mech2).status_code == 404
    assert ctx.client.delete(f"{OS}/{oid}/items/{item_id}", headers=ctx.mech).status_code == 204


def test_finished_order_patch_limits(ctx, vid):
    oid = ctx.order(vid)["id"]
    ctx.advance(oid, "finalizada")
    assert ctx.client.patch(
        f"{OS}/{oid}", json={"diagnosis": "Concluído"}, headers=ctx.admin
    ).status_code == 200
    for body in (
        {"labor_cost": "1.00"}, {"mechanic_id": ctx.mech_user.id}, {"reported_issue": "x"}
    ):
        assert ctx.client.patch(f"{OS}/{oid}", json=body, headers=ctx.admin).status_code == 422
    ctx.move(oid, "entregue")
    assert ctx.client.patch(
        f"{OS}/{oid}", json={"diagnosis": "x"}, headers=ctx.admin
    ).status_code == 422


# ---- visibilidade do mecânico, listagem, filtros ----------------------------------------------


def test_mechanic_scope_list_and_read(ctx, vid):
    mine = ctx.order(vid, mechanic_id=ctx.mech_user.id)["id"]
    theirs = ctx.order(vid, mechanic_id=ctx.mech2_user.id)["id"]
    unassigned = ctx.order(vid)["id"]

    page = ctx.client.get(OS, headers=ctx.mech).json()
    assert [o["id"] for o in page["items"]] == [mine]
    assert page["total"] == 1
    assert ctx.client.get(f"{OS}/{mine}", headers=ctx.mech).status_code == 200
    for other in (theirs, unassigned):
        assert ctx.client.get(f"{OS}/{other}", headers=ctx.mech).status_code == 404
    # filtro por outro mecânico não vaza; o próprio id funciona
    assert ctx.client.get(
        OS, params={"mechanic_id": ctx.mech2_user.id}, headers=ctx.mech
    ).json()["items"] == []
    assert ctx.client.get(
        OS, params={"mechanic_id": ctx.mech_user.id}, headers=ctx.mech
    ).json()["total"] == 1
    # recepção/admin veem tudo
    assert ctx.client.get(OS, headers=ctx.reception).json()["total"] == 3


def test_list_filters_search_and_pagination(ctx):
    v1 = ctx.vehicle("Maria Ficticia")
    v2 = ctx.vehicle("João Ficticio")
    a = ctx.order(v1, mechanic_id=ctx.mech_user.id)["id"]
    b = ctx.order(v2)["id"]
    c = ctx.order(v2)["id"]
    ctx.move(c, "aguardando_orcamento")

    def ids(**params):
        r = ctx.client.get(OS, params=params, headers=ctx.reception)
        assert r.status_code == 200
        return [o["id"] for o in r.json()["items"]]

    assert ids() == [c, b, a]  # mais recentes primeiro
    assert ids(status="aberta") == [b, a]
    assert ids(status="aguardando_orcamento") == [c]
    assert ids(vehicle_id=v2) == [c, b]
    assert ids(mechanic_id=ctx.mech_user.id) == [a]
    assert ids(q="OS-000002") == [b]
    assert ids(q="000003") == [c]
    assert ids(q="ABC1") == [a]  # placa parcial (primeira placa gerada)
    assert ids(q="maria") == [a]
    assert ids(q="ficticio") == [c, b]
    assert ids(q="%") == []
    assert ids(q="_") == []
    assert ids(vehicle_id=v2, status="aberta") == [b]
    r = ctx.client.get(OS, params={"size": 2, "page": 2}, headers=ctx.admin).json()
    assert [o["id"] for o in r["items"]] == [a]
    assert (r["total"], r["page"], r["size"]) == (3, 2, 2)


def test_list_query_validation(ctx):
    for params in ({"page": 0}, {"size": 101}, {"size": 0}, {"status": "x"}, {"vehicle_id": 0}):
        assert ctx.client.get(OS, params=params, headers=ctx.admin).status_code == 422


# ---- exclusão lógica ---------------------------------------------------------------------------


def test_soft_delete_rules(ctx, vid):
    oid = ctx.order(vid)["id"]
    assert ctx.client.delete(f"{OS}/{oid}", headers=ctx.reception).status_code == 403
    assert ctx.client.delete(f"{OS}/{oid}", headers=ctx.mech).status_code == 403
    assert ctx.client.delete(f"{OS}/{oid}", headers=ctx.admin).status_code == 204
    assert ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).status_code == 404
    assert ctx.client.get(OS, headers=ctx.admin).json()["total"] == 0
    assert ctx.client.delete(f"{OS}/{oid}", headers=ctx.admin).status_code == 404
    assert ctx.move(oid, "aguardando_orcamento").status_code == 404
    assert ctx.item(oid).status_code == 404


def test_delete_only_when_open(ctx, vid):
    oid = ctx.order(vid)["id"]
    ctx.move(oid, "aguardando_orcamento")
    r = ctx.client.delete(f"{OS}/{oid}", headers=ctx.admin)
    assert r.status_code == 422
    assert ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).status_code == 200


# ---- autenticação e 404 ------------------------------------------------------------------------


def test_requires_authentication(client):
    for method, url in (
        ("get", OS), ("post", OS), ("get", f"{OS}/1"), ("patch", f"{OS}/1"),
        ("post", f"{OS}/1/status"), ("post", f"{OS}/1/items"),
        ("patch", f"{OS}/1/items/1"), ("delete", f"{OS}/1/items/1"), ("delete", f"{OS}/1"),
    ):
        assert getattr(client, method)(url).status_code == 401, (method, url)


def test_unknown_order_404(ctx):
    assert ctx.client.get(f"{OS}/9999", headers=ctx.admin).status_code == 404
    assert ctx.client.patch(f"{OS}/9999", json={}, headers=ctx.admin).status_code == 404
    assert ctx.move(9999, "aguardando_orcamento").status_code == 404
    assert ctx.client.delete(f"{OS}/9999", headers=ctx.admin).status_code == 404


def test_money_serialized_as_fixed_decimal_strings(ctx, vid):
    oid = ctx.order(vid, labor_cost=10)["id"]
    ctx.item(oid, qty=2, unit_price=3)
    body = ctx.client.get(f"{OS}/{oid}", headers=ctx.admin).json()
    assert body["labor_cost"] == "10.00"
    assert body["total"] == "16.00"
    assert body["items"][0]["qty"] == "2.000"
    assert body["items"][0]["unit_price"] == "3.00"
    assert body["items"][0]["line_total"] == "6.00"
    listed = ctx.client.get(OS, headers=ctx.admin).json()["items"][0]
    assert listed["total"] == "16.00"

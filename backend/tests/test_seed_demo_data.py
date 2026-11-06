import re

from app.domain.document import is_valid_cnpj, is_valid_cpf
from app.domain.vehicle import is_valid_chassis, is_valid_plate, is_valid_year
from app.seed.demo_data import build_customers, build_vehicles


def test_counts():
    assert len(build_customers()) == 18
    assert len(build_vehicles()) == 28


def test_documents_valid_and_unique():
    docs = [c.document for c in build_customers()]
    assert len(set(docs)) == len(docs)
    assert all(is_valid_cpf(d) or is_valid_cnpj(d) for d in docs)
    assert any(len(d) == 11 for d in docs) and any(len(d) == 14 for d in docs)


def test_customers_use_fake_contacts():
    customers = build_customers()
    assert any(c.phone for c in customers) and any(c.email for c in customers)
    assert any(c.notes for c in customers)
    for c in customers:
        if c.email:
            assert c.email.endswith("@example.com") or ".example.com" in c.email
        if c.phone:
            assert re.fullmatch(r"\d{10,11}", c.phone)


def test_vehicles_valid_and_unique():
    vehicles = build_vehicles(2026)
    plates = [v.plate for v in vehicles]
    vins = [v.chassis for v in vehicles]
    assert len(set(plates)) == len(plates) and len(set(vins)) == len(vins)
    assert all(is_valid_plate(p) for p in plates)
    assert all(is_valid_chassis(v) for v in vins)
    assert all(is_valid_year(v.year, current_year=2026) for v in vehicles)
    assert any(re.fullmatch(r"[A-Z]{3}\d{4}", p) for p in plates)
    assert any(re.fullmatch(r"[A-Z]{3}\d[A-Z]\d{2}", p) for p in plates)


def test_vehicle_owners_exist_and_readings_ascending():
    docs = {c.document for c in build_customers()}
    for v in build_vehicles():
        assert v.owner_document in docs
        assert 1 <= len(v.readings) <= 3
        kms = [r.km for r in v.readings]
        days = [r.days_ago for r in v.readings]
        assert kms == sorted(set(kms))
        assert days == sorted(days, reverse=True)


def test_deterministic():
    assert build_vehicles() == build_vehicles()

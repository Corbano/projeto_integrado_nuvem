import pytest

from app.domain.vehicle import (
    Fuel,
    is_valid_chassis,
    is_valid_plate,
    is_valid_renavam,
    is_valid_year,
    normalize_chassis,
    normalize_plate,
)


@pytest.mark.parametrize(
    "plate", ["ABC1234", "abc1234", "abc-1234", " ABC1234 ", "ABC1D23", "abc-1d23"]
)
def test_valid_plates(plate):
    assert is_valid_plate(plate)


@pytest.mark.parametrize(
    "plate",
    [
        "", "AB1234", "ABCD123", "ABC123", "ABC12345", "1BC1234", "ABC-12D3", "A-BC1234",
        "ABC 1234", "ABC1DD3", "ABC--1234", "ABC1234!", "ÁBC1234",
    ],
)
def test_invalid_plates(plate):
    assert not is_valid_plate(plate)


def test_normalize_plate():
    assert normalize_plate("abc-1234") == "ABC1234"
    assert normalize_plate(" abc1d23 ") == "ABC1D23"


def test_chassis():
    assert is_valid_chassis("abcdefgh123456789")
    assert normalize_chassis(" abcdefgh123456789 ") == "ABCDEFGH123456789"
    for bad in [
        "ABCDEFGH12345678", "ABCDEFGH1234567890", "ABCDEFGI123456789",
        "ABCDEFGO123456789", "ABCDEFGQ123456789", "ABCDEFGH12345678-",
    ]:
        assert not is_valid_chassis(bad)


def test_renavam():
    assert is_valid_renavam("123456789")
    assert is_valid_renavam("12345678901")
    assert not is_valid_renavam("12345678")
    assert not is_valid_renavam("123456789012")
    assert not is_valid_renavam("12345678a")


def test_year_range():
    assert is_valid_year(1950, current_year=2026)
    assert is_valid_year(2027, current_year=2026)
    assert not is_valid_year(1949, current_year=2026)
    assert not is_valid_year(2028, current_year=2026)


def test_fuel_values():
    assert {f.value for f in Fuel} == {
        "gasolina", "etanol", "flex", "diesel", "gnv", "eletrico", "hibrido"
    }

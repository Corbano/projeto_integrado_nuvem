import pytest

from app.domain.errors import BusinessRuleError
from app.domain.km import MAX_KM, KmSource, validate_km_update


def test_increase_is_recorded():
    assert validate_km_update(100, 150, False) is True


def test_equal_is_a_noop():
    assert validate_km_update(100, 100, False) is False
    assert validate_km_update(100, 100, True) is False


def test_decrease_is_blocked_with_message():
    with pytest.raises(BusinessRuleError, match="A quilometragem não pode diminuir"):
        validate_km_update(100, 99, False)


def test_admin_force_allows_decrease():
    assert validate_km_update(100, 50, True) is True


@pytest.mark.parametrize("bad", [-1, MAX_KM + 1])
def test_out_of_range_rejected(bad):
    with pytest.raises(BusinessRuleError):
        validate_km_update(0, bad, False)


def test_sources():
    assert {s.value for s in KmSource} == {"manual", "checkin", "service_order"}

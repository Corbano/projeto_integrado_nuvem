import itertools
from decimal import Decimal

import pytest

from app.domain.errors import BusinessRuleError
from app.domain.roles import Role
from app.domain.service_order import (
    TRANSITION_ROLES,
    TRANSITIONS,
    OrderStatus,
    can_transition,
    compute_total,
    format_number,
    is_valid_rule_code,
    line_total,
    validate_transition,
)

S = OrderStatus
ALL_PAIRS = list(itertools.product(OrderStatus, OrderStatus))
VALID = {(a, b) for a, targets in TRANSITIONS.items() for b in targets}


def test_valid_set_is_exactly_the_documented_flow():
    assert VALID == {
        (S.OPEN, S.AWAITING_QUOTE),
        (S.AWAITING_QUOTE, S.AWAITING_APPROVAL),
        (S.AWAITING_APPROVAL, S.IN_PROGRESS),
        (S.IN_PROGRESS, S.FINISHED),
        (S.FINISHED, S.DELIVERED),
        (S.AWAITING_APPROVAL, S.AWAITING_QUOTE),
    }


@pytest.mark.parametrize(("current", "target"), ALL_PAIRS)
def test_full_transition_matrix(current, target):
    if (current, target) in VALID:
        validate_transition(current, target)
    else:
        with pytest.raises(BusinessRuleError, match="Transição inválida") as exc:
            validate_transition(current, target)
        for allowed in TRANSITIONS[current]:
            assert allowed.value in exc.value.message


def test_terminal_state_lists_none():
    with pytest.raises(BusinessRuleError, match="Permitidas: nenhuma"):
        validate_transition(S.DELIVERED, S.OPEN)


@pytest.mark.parametrize(("current", "target"), ALL_PAIRS)
@pytest.mark.parametrize("role", list(Role))
def test_permission_matrix(role, current, target):
    expected = {
        Role.ADMIN: (current, target) in VALID,
        Role.RECEPTION: (current, target) in VALID - {(S.IN_PROGRESS, S.FINISHED)},
        Role.MECHANIC: (current, target) == (S.IN_PROGRESS, S.FINISHED),
    }[role]
    assert can_transition(role, current, target) is expected


def test_every_valid_transition_has_a_role_entry():
    assert set(TRANSITION_ROLES) == VALID


@pytest.mark.parametrize(
    ("labor", "lines", "expected"),
    [
        ("0", [], "0.00"),
        ("100.00", [], "100.00"),
        ("10.00", [("2", "5.50")], "21.00"),
        # arredondamento metade para cima por linha (não bancário)
        ("0", [("3", "19.995")], "59.99"),
        ("0", [("1.005", "1.00")], "1.01"),
        ("0", [("0.333", "10.00")], "3.33"),
        ("0", [("0.5", "0.01")], "0.01"),
        ("0.00", [("2.500", "3.33")], "8.33"),
        ("5.00", [("1", "10.00"), ("0.250", "7.99")], "17.00"),
    ],
)
def test_compute_total(labor, lines, expected):
    parsed = [(Decimal(q), Decimal(p)) for q, p in lines]
    assert compute_total(Decimal(labor), parsed) == Decimal(expected)


def test_line_total_uses_half_up():
    assert line_total(Decimal("3"), Decimal("19.995")) == Decimal("59.99")
    assert line_total(Decimal("0.5"), Decimal("0.03")) == Decimal("0.02")  # 0.015 -> 0.02


def test_total_above_limit_is_rejected():
    with pytest.raises(BusinessRuleError, match="excede o limite"):
        compute_total(Decimal("0"), [(Decimal("9999.999"), Decimal("999999.99"))])


@pytest.mark.parametrize("code", ["troca_oleo", "a", "x" * 40, "abc_123"])
def test_rule_code_valid(code):
    assert is_valid_rule_code(code)


@pytest.mark.parametrize("code", ["", "Troca", "troca-oleo", "troca oleo", "x" * 41, "óleo", "a\n"])
def test_rule_code_invalid(code):
    assert not is_valid_rule_code(code)


def test_number_format():
    assert format_number(1) == "OS-000001"
    assert format_number(1234567) == "OS-1234567"

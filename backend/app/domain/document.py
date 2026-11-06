"""Validação de CPF e CNPJ (funções puras)."""

import re


def normalize_digits(value: str) -> str:
    """Remove tudo que não for dígito (máscara, espaços)."""
    return re.sub(r"\D", "", value)


def _check_digit(digits: str, weights: list[int]) -> int:
    total = sum(int(d) * w for d, w in zip(digits, weights, strict=False))
    rest = total % 11
    return 0 if rest < 2 else 11 - rest


def is_valid_cpf(value: str) -> bool:
    digits = normalize_digits(value)
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    first = _check_digit(digits[:9], list(range(10, 1, -1)))
    second = _check_digit(digits[:10], list(range(11, 1, -1)))
    return digits[9:] == f"{first}{second}"


_CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
_CNPJ_W2 = [6, *_CNPJ_W1]


def is_valid_cnpj(value: str) -> bool:
    digits = normalize_digits(value)
    if len(digits) != 14 or len(set(digits)) == 1:
        return False
    first = _check_digit(digits[:12], _CNPJ_W1)
    second = _check_digit(digits[:13], _CNPJ_W2)
    return digits[12:] == f"{first}{second}"


def is_valid_document(value: str) -> bool:
    return is_valid_cpf(value) or is_valid_cnpj(value)

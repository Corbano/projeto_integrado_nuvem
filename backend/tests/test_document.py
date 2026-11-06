import pytest

from app.domain.document import (
    is_valid_cnpj,
    is_valid_cpf,
    is_valid_document,
    normalize_digits,
)

VALID_CPF = "52998224725"
VALID_CNPJ = "11222333000181"


def test_normalize_digits_strips_mask():
    assert normalize_digits("529.982.247-25") == "52998224725"
    assert normalize_digits("11.222.333/0001-81") == "11222333000181"


@pytest.mark.parametrize(
    "value", ["abc52998224725x", "529.982.247-25a", "(52998224725)", "5299822472\u00005"]
)
def test_documents_with_foreign_characters_are_invalid(value):
    assert not is_valid_cpf(value)
    assert not is_valid_document(value)


def test_cnpj_with_foreign_characters_is_invalid():
    assert not is_valid_cnpj("x11222333000181")
    assert not is_valid_cnpj("11.222.333/0001-81!")


def test_valid_cpf_with_and_without_mask():
    assert is_valid_cpf(VALID_CPF)
    assert is_valid_cpf("529.982.247-25")


@pytest.mark.parametrize(
    "value",
    ["52998224724", "52998224735", "1234567890", "529982247255", "", "abcdefghijk"],
)
def test_invalid_cpf(value):
    assert not is_valid_cpf(value)


@pytest.mark.parametrize("digit", "0123456789")
def test_cpf_with_all_equal_digits_is_invalid(digit):
    assert not is_valid_cpf(digit * 11)


def test_valid_cnpj_with_and_without_mask():
    assert is_valid_cnpj(VALID_CNPJ)
    assert is_valid_cnpj("11.222.333/0001-81")


@pytest.mark.parametrize("value", ["11222333000180", "11222333000191", "1122233300018", ""])
def test_invalid_cnpj(value):
    assert not is_valid_cnpj(value)


@pytest.mark.parametrize("digit", "0123456789")
def test_cnpj_with_all_equal_digits_is_invalid(digit):
    assert not is_valid_cnpj(digit * 14)


def test_is_valid_document_accepts_cpf_or_cnpj():
    assert is_valid_document(VALID_CPF)
    assert is_valid_document(VALID_CNPJ)
    assert not is_valid_document("123")
    assert not is_valid_document("52998224724")

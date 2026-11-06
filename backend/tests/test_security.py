import pytest

from app.domain.errors import AuthenticationError, BusinessRuleError
from app.domain.roles import Role
from app.infrastructure.security import BcryptHasher, JwtCodec

SECRET = "s" * 40


def test_hash_and_verify_roundtrip():
    hasher = BcryptHasher(rounds=4)

    hashed = hasher.hash("senha-segura-1")

    assert hashed != "senha-segura-1"
    assert hasher.verify("senha-segura-1", hashed) is True
    assert hasher.verify("outra-senha", hashed) is False


def test_verify_returns_false_for_malformed_hash():
    assert BcryptHasher(rounds=4).verify("x", "isso-nao-e-bcrypt") is False


def test_hash_rejects_password_over_72_bytes():
    with pytest.raises(BusinessRuleError):
        BcryptHasher(rounds=4).hash("a" * 73)


def test_token_roundtrip():
    codec = JwtCodec(SECRET)

    payload = codec.decode(codec.encode(7, Role.MECHANIC))

    assert payload.user_id == 7
    assert payload.role is Role.MECHANIC


def test_expired_token_is_rejected():
    codec = JwtCodec(SECRET, expires_minutes=-1)

    with pytest.raises(AuthenticationError):
        codec.decode(codec.encode(1, Role.ADMIN))


def test_token_signed_with_other_secret_is_rejected():
    token = JwtCodec("a" * 40).encode(1, Role.ADMIN)

    with pytest.raises(AuthenticationError):
        JwtCodec("b" * 40).decode(token)


def test_garbage_token_is_rejected():
    with pytest.raises(AuthenticationError):
        JwtCodec(SECRET).decode("nao.e.um-jwt")

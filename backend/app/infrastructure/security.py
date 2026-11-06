from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.domain.errors import AuthenticationError, BusinessRuleError
from app.domain.roles import Role


class BcryptHasher:
    def __init__(self, rounds: int = 12) -> None:
        self._rounds = rounds

    def hash(self, password: str) -> str:
        raw = password.encode("utf-8")
        if len(raw) > 72:
            raise BusinessRuleError("A senha deve ter no máximo 72 bytes")
        return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=self._rounds)).decode("utf-8")

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False


@dataclass(frozen=True)
class TokenPayload:
    user_id: int
    role: Role


class JwtCodec:
    def __init__(
        self, secret: str, algorithm: str = "HS256", expires_minutes: int = 60
    ) -> None:
        self._secret = secret
        self._algorithm = algorithm
        self._expires_minutes = expires_minutes

    def encode(self, user_id: int, role: Role) -> str:
        now = datetime.now(UTC)
        claims = {
            "sub": str(user_id),
            "role": role.value,
            "iat": now,
            "exp": now + timedelta(minutes=self._expires_minutes),
        }
        return jwt.encode(claims, self._secret, algorithm=self._algorithm)

    def decode(self, token: str) -> TokenPayload:
        try:
            claims = jwt.decode(token, self._secret, algorithms=[self._algorithm])
            return TokenPayload(user_id=int(claims["sub"]), role=Role(claims["role"]))
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise AuthenticationError("Token inválido ou expirado") from exc

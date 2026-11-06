from app.application.dtos.auth import TokenResponse
from app.application.ports import PasswordHasher, TokenCodec
from app.domain.errors import AuthenticationError
from app.domain.user import UserRepository


class AuthService:
    def __init__(
        self, users: UserRepository, hasher: PasswordHasher, codec: TokenCodec
    ) -> None:
        self._users = users
        self._hasher = hasher
        self._codec = codec

    def login(self, email: str, password: str) -> TokenResponse:
        user = self._users.get_by_email(email.lower())
        # Mesma mensagem para qualquer falha: não revela se o e-mail existe.
        if user is None or not user.active or not self._hasher.verify(password, user.password_hash):
            raise AuthenticationError("Credenciais inválidas")
        return TokenResponse(access_token=self._codec.encode(user.id, user.role))

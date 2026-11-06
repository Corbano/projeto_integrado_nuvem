from app.application.dtos.auth import TokenResponse
from app.application.ports import PasswordHasher, TokenCodec
from app.domain.errors import AuthenticationError
from app.domain.user import UserRepository

# Hash bcrypt (custo 12) de uma senha descartável; não é segredo. Gerado uma única vez.
_DUMMY_PASSWORD_HASH = "$2b$12$C1Suo5f5h1ztDpEm5I4lxeSySsgeKyklUnNqCf6brAfneGWBVW3KO"


class AuthService:
    def __init__(
        self, users: UserRepository, hasher: PasswordHasher, codec: TokenCodec
    ) -> None:
        self._users = users
        self._hasher = hasher
        self._codec = codec

    def login(self, email: str, password: str) -> TokenResponse:
        user = self._users.get_by_email(email.lower())
        # Sempre executa o verify (contra um hash falso se o usuário não existe) para que o
        # tempo de resposta não revele se o e-mail existe. Mesma mensagem para qualquer falha.
        password_ok = self._hasher.verify(
            password, user.password_hash if user else _DUMMY_PASSWORD_HASH
        )
        if user is None or not user.active or not password_ok:
            raise AuthenticationError("Credenciais inválidas")
        return TokenResponse(access_token=self._codec.encode(user.id, user.role))

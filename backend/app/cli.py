import argparse
import getpass
import os
import sys
from collections.abc import Callable, Sequence

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.application.dtos.user import UserCreate
from app.application.ports import PasswordHasher
from app.application.services.user_service import UserService
from app.domain.errors import AppError
from app.domain.roles import Role
from app.infrastructure.config import get_settings
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.security import BcryptHasher


def _validation_message(exc: ValidationError) -> str:
    # Nunca usar str(exc): inclui input_value e vazaria a senha digitada.
    return "; ".join(
        f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
    )


def run(
    argv: Sequence[str] | None = None,
    *,
    session_factory: Callable[[], Session] = SessionLocal,
    hasher: PasswordHasher | None = None,
    prompt_password: Callable[[str], str] = getpass.getpass,
) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-admin", help="Cria um usuário administrador")
    create.add_argument("--name", required=True)
    create.add_argument("--email", required=True)
    create.add_argument(
        "--password",
        help="Opcional (evite: vaza no histórico do shell). "
        "Alternativas: variável ADMIN_PASSWORD ou prompt interativo.",
    )
    args = parser.parse_args(argv)

    # Precedência: --password > ADMIN_PASSWORD > prompt
    password = args.password or os.environ.get("ADMIN_PASSWORD") or prompt_password("Senha: ")

    hasher = hasher or BcryptHasher(rounds=get_settings().bcrypt_rounds)
    try:
        with session_factory() as db:
            service = UserService(SqlUserRepository(db), hasher)
            created = service.create(
                UserCreate(name=args.name, email=args.email, password=password, role=Role.ADMIN)
            )
    except (AppError, ValidationError) as exc:
        message = exc.message if isinstance(exc, AppError) else _validation_message(exc)
        print(f"Erro: {message}", file=sys.stderr)
        return 1

    print(f"Administrador criado: {created.email} (id {created.id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

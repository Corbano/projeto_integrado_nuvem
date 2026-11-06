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
from app.domain.user import User
from app.infrastructure.config import get_settings
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.user_repository import SqlUserRepository
from app.infrastructure.security import BcryptHasher
from app.seed.runner import seed_demo


def _validation_message(exc: ValidationError) -> str:
    # Nunca usar str(exc): inclui input_value e vazaria a senha digitada.
    return "; ".join(
        f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
    )


def _is_production() -> bool:
    if os.environ.get("ENVIRONMENT", "").strip().lower() == "production":
        return True
    try:
        return get_settings().environment == "production"
    except ValidationError:  # configuração de produção inválida ainda é produção
        return True


def _find_actor(db: Session, email: str | None) -> User | None:
    users = SqlUserRepository(db)
    if email:
        user = users.get_by_email(email.strip().lower())
        return user if user and user.active and user.role is Role.ADMIN else None
    page = 1
    while True:
        items, total = users.list_page(offset=(page - 1) * 100, limit=100, search=None)
        for user in items:
            if user.active and user.role is Role.ADMIN:
                return user
        if page * 100 >= total:
            return None
        page += 1


def _seed_demo(args: argparse.Namespace, session_factory: Callable[[], Session]) -> int:
    if _is_production():
        print("Erro: seed-demo não pode rodar com ENVIRONMENT=production.", file=sys.stderr)
        return 1
    with session_factory() as db:
        actor = _find_actor(db, args.actor_email)
        if actor is None:
            print(
                "Erro: nenhum administrador ativo encontrado. Rode create-admin primeiro.",
                file=sys.stderr,
            )
            return 1
        try:
            summary = seed_demo(db, actor, dry_run=args.count_only)
        except (AppError, ValidationError) as exc:
            message = exc.message if isinstance(exc, AppError) else _validation_message(exc)
            print(f"Erro: {message}", file=sys.stderr)
            return 1
    prefix = "[simulação] " if args.count_only else ""
    print(prefix + summary.message())
    return 0


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
    demo = sub.add_parser(
        "seed-demo", help="Popula o banco de DEV com dados fictícios de demonstração"
    )
    demo.add_argument(
        "--actor-email", help="Administrador autor dos dados (padrão: o primeiro ativo)"
    )
    demo.add_argument("--count-only", action="store_true", help="Só mostra o que seria criado")
    args = parser.parse_args(argv)

    if args.command == "seed-demo":
        return _seed_demo(args, session_factory)

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

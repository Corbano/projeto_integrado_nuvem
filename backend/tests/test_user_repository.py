import pytest

from app.domain.errors import ConflictError, NotFoundError
from app.domain.roles import Role
from app.domain.user import User
from app.infrastructure.repositories.user_repository import SqlUserRepository


@pytest.fixture
def repo(db_session):
    return SqlUserRepository(db_session)


def new_user(email="ana@example.com", name="Ana", role=Role.ADMIN) -> User:
    return User(id=None, name=name, email=email, password_hash="hash", role=role)


def test_add_assigns_id_and_roundtrips(repo):
    saved = repo.add(new_user())

    assert saved.id is not None
    assert repo.get_by_id(saved.id) == saved
    assert repo.get_by_email("ana@example.com") == saved


def test_get_missing_returns_none(repo):
    assert repo.get_by_id(999) is None
    assert repo.get_by_email("nao@existe.com") is None


def test_update_persists_changes(repo):
    saved = repo.add(new_user())
    saved.name = "Ana Maria"
    saved.role = Role.RECEPTION
    saved.active = False

    updated = repo.update(saved)

    assert updated.name == "Ana Maria"
    assert repo.get_by_id(saved.id).role is Role.RECEPTION
    assert repo.get_by_id(saved.id).active is False


def test_soft_delete_hides_user_but_reserves_email(repo):
    saved = repo.add(new_user())

    repo.soft_delete(saved.id)

    assert repo.get_by_id(saved.id) is None
    assert repo.get_by_email("ana@example.com") is None
    assert repo.email_exists("ana@example.com") is True


def test_soft_delete_missing_raises(repo):
    with pytest.raises(NotFoundError):
        repo.soft_delete(999)


def test_list_page_paginates_and_counts(repo):
    for i in range(5):
        repo.add(new_user(email=f"u{i}@example.com", name=f"User {i}"))

    items, total = repo.list_page(offset=2, limit=2, search=None)

    assert total == 5
    assert [u.email for u in items] == ["u2@example.com", "u3@example.com"]


def test_list_page_search_matches_name_or_email(repo):
    repo.add(new_user(email="joao@oficina.com", name="João"))
    repo.add(new_user(email="maria@oficina.com", name="Maria"))

    by_name, total_name = repo.list_page(offset=0, limit=10, search="joão")
    by_email, total_email = repo.list_page(offset=0, limit=10, search="maria@")

    assert total_name == 1 and by_name[0].name == "João"
    assert total_email == 1 and by_email[0].name == "Maria"


def test_add_duplicate_email_raises_conflict(repo):
    repo.add(new_user())

    with pytest.raises(ConflictError):
        repo.add(new_user(name="Outra Ana"))


def test_session_usable_after_duplicate_email(repo):
    first = repo.add(new_user())

    with pytest.raises(ConflictError):
        repo.add(new_user(name="Outra Ana"))

    assert repo.get_by_email("ana@example.com") == first
    other = repo.add(new_user(email="outra@example.com", name="Outra"))
    assert other.id is not None


def test_list_page_search_escapes_like_wildcards(repo):
    repo.add(new_user(email="a@example.com", name="Ana"))
    repo.add(new_user(email="b@example.com", name="Bia"))

    _, total_percent = repo.list_page(offset=0, limit=10, search="%")
    _, total_underscore = repo.list_page(offset=0, limit=10, search="_")
    found, total_a = repo.list_page(offset=0, limit=10, search="a@")

    assert total_percent == 0
    assert total_underscore == 0
    assert total_a == 1 and found[0].email == "a@example.com"


def test_list_page_excludes_deleted(repo):
    keep = repo.add(new_user(email="a@example.com"))
    gone = repo.add(new_user(email="b@example.com"))
    repo.soft_delete(gone.id)

    items, total = repo.list_page(offset=0, limit=10, search=None)

    assert total == 1 and items[0].id == keep.id

import pytest

from app.domain.customer import Customer
from app.domain.errors import ConflictError, NotFoundError
from app.infrastructure.repositories.customer_repository import SqlCustomerRepository

CPF_A = "52998224725"
CPF_B = "11144477735"


@pytest.fixture
def repo(db_session):
    return SqlCustomerRepository(db_session)


def new_customer(document=CPF_A, name="Cliente Ficticio Um", **kwargs) -> Customer:
    return Customer(id=None, name=name, document=document, **kwargs)


def test_add_assigns_id_and_roundtrips(repo):
    saved = repo.add(new_customer(phone="11999990000", email="a@example.com", notes="x"))

    assert saved.id is not None
    assert repo.get_by_id(saved.id) == saved


def test_get_missing_returns_none(repo):
    assert repo.get_by_id(999) is None


def test_duplicate_document_raises_conflict_and_session_stays_usable(repo):
    repo.add(new_customer())

    with pytest.raises(ConflictError):
        repo.add(new_customer(name="Outro"))

    assert repo.add(new_customer(document=CPF_B)).id is not None


def test_document_exists_ignores_deleted_and_supports_exclude(repo):
    saved = repo.add(new_customer())

    assert repo.document_exists(CPF_A)
    assert not repo.document_exists(CPF_A, exclude_id=saved.id)
    assert not repo.document_exists(CPF_B)
    repo.soft_delete(saved.id)
    assert not repo.document_exists(CPF_A)


def test_soft_deleted_document_can_be_reused(repo):
    saved = repo.add(new_customer())
    repo.soft_delete(saved.id)

    again = repo.add(new_customer(name="Novo Dono"))

    assert again.id != saved.id
    assert repo.get_by_id(saved.id) is None


def test_update_persists_and_missing_raises(repo):
    saved = repo.add(new_customer())
    saved.name = "Nome Novo"
    saved.updated_by_id = None

    assert repo.update(saved).name == "Nome Novo"
    with pytest.raises(NotFoundError):
        repo.update(Customer(id=999, name="Fantasma", document=CPF_B))


def test_soft_delete_missing_raises(repo):
    with pytest.raises(NotFoundError):
        repo.soft_delete(999)


def test_has_vehicles_is_false_until_b2(repo):
    saved = repo.add(new_customer())

    assert repo.has_vehicles(saved.id) is False


def test_list_page_paginates_and_searches(repo):
    repo.add(new_customer(name="Maria Ficticia", phone="11988887777", email="maria@example.com"))
    repo.add(new_customer(document=CPF_B, name="Joao Ficticio"))

    items, total = repo.list_page(offset=0, limit=1, search=None)
    assert (len(items), total) == (1, 2)
    assert repo.list_page(offset=0, limit=10, search="maria")[1] == 1
    assert repo.list_page(offset=0, limit=10, search="1144")[1] == 1
    assert repo.list_page(offset=0, limit=10, search="98888")[1] == 1
    assert repo.list_page(offset=0, limit=10, search="example.com")[1] == 1


def test_list_page_escapes_like_wildcards(repo):
    repo.add(new_customer(name="Maria Ficticia"))

    assert repo.list_page(offset=0, limit=10, search="%")[1] == 0
    assert repo.list_page(offset=0, limit=10, search="_")[1] == 0

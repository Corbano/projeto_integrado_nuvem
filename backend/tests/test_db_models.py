import pytest
from sqlalchemy.exc import IntegrityError

from app.infrastructure.db.models.user import UserModel


def test_user_model_has_defaults(db_session):
    user = UserModel(name="Ana", email="ana@example.com", password_hash="h", role="admin")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.active is True
    assert user.deleted_at is None
    assert user.created_at is not None
    assert user.updated_at is not None


def test_user_email_is_unique(db_session):
    db_session.add(UserModel(name="A", email="dup@example.com", password_hash="h", role="admin"))
    db_session.commit()
    db_session.add(UserModel(name="B", email="dup@example.com", password_hash="h", role="admin"))

    with pytest.raises(IntegrityError):
        db_session.commit()

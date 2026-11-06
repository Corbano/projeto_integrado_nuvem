import pytest

from app.domain.checkin import (
    ChecklistItem,
    photo_extension,
    photo_storage_key,
    validate_checklist,
    validate_photo,
)
from app.domain.errors import BusinessRuleError


def test_seven_checklist_items_required():
    assert len(ChecklistItem) == 7
    validate_checklist(list(ChecklistItem))


def test_missing_checklist_item_rejected():
    with pytest.raises(BusinessRuleError, match="ausentes"):
        validate_checklist(list(ChecklistItem)[:-1])


def test_duplicated_checklist_item_rejected():
    items = list(ChecklistItem)[:-1] + [ChecklistItem.TIRES]
    with pytest.raises(BusinessRuleError, match="repetidos"):
        validate_checklist(items)


@pytest.mark.parametrize(
    ("content_type", "ext"),
    [("image/jpeg", "jpg"), ("image/png", "png"), ("image/webp", "webp")],
)
def test_photo_extension_from_content_type(content_type, ext):
    assert photo_extension(content_type) == ext
    assert photo_storage_key(7, "abc", content_type) == f"checkins/7/abc.{ext}"


@pytest.mark.parametrize("content_type", ["image/gif", "text/html", "image/jpeg; x=y", ""])
def test_photo_type_rejected(content_type):
    with pytest.raises(BusinessRuleError):
        photo_extension(content_type)


@pytest.mark.parametrize("size", [0, -1, 8 * 1024 * 1024 + 1])
def test_photo_size_rejected(size):
    with pytest.raises(BusinessRuleError):
        validate_photo("image/png", size)


def test_photo_size_limit_inclusive():
    validate_photo("image/png", 8 * 1024 * 1024)
    validate_photo("image/png", 1)

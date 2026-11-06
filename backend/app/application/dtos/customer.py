from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.domain.customer import Customer
from app.domain.document import is_valid_document, normalize_digits


def _clean_document(value: str) -> str:
    digits = normalize_digits(value)
    if not is_valid_document(digits):
        raise ValueError("CPF/CNPJ inválido")
    return digits


def _clean_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    digits = normalize_digits(value)
    if len(digits) not in (10, 11):
        raise ValueError("Telefone deve ter 10 ou 11 dígitos")
    return digits


def _clean_text(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    document: str = Field(max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Nome deve ter ao menos 2 caracteres")
        return value

    @field_validator("document")
    @classmethod
    def _document(cls, value: str) -> str:
        return _clean_document(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _clean_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: str | None) -> str | None:
        return _clean_text(value)


class CustomerUpdate(BaseModel):
    """PATCH: campos ausentes não mudam; `null` limpa phone/email/notes."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    document: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Nome não pode ser nulo")
        return CustomerCreate._strip_name(value)

    @field_validator("document")
    @classmethod
    def _document(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Documento não pode ser nulo")
        return _clean_document(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _clean_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: str | None) -> str | None:
        return _clean_text(value)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    document: str
    phone: str | None
    email: str | None
    notes: str | None

    @classmethod
    def from_entity(cls, customer: Customer) -> "CustomerOut":
        return cls(
            id=customer.id,
            name=customer.name,
            document=customer.document,
            phone=customer.phone,
            email=customer.email,
            notes=customer.notes,
        )

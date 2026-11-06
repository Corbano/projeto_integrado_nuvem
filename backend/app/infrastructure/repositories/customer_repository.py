import re
from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.customer import Customer
from app.domain.document import normalize_digits
from app.domain.errors import ConflictError, NotFoundError
from app.infrastructure.db.models.customer import CustomerModel

_DUPLICATE = "Já existe um cliente com este CPF/CNPJ"
_MASKED_NUMBER = re.compile(r"[\d.\-/\s()]*\d[\d.\-/\s()]*")


def _escape(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class SqlCustomerRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _to_entity(model: CustomerModel) -> Customer:
        return Customer(
            id=model.id,
            name=model.name,
            document=model.document,
            phone=model.phone,
            email=model.email,
            notes=model.notes,
            created_by_id=model.created_by_id,
            updated_by_id=model.updated_by_id,
        )

    @staticmethod
    def _alive() -> Select[tuple[CustomerModel]]:
        return select(CustomerModel).where(CustomerModel.deleted_at.is_(None))

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise ConflictError(_DUPLICATE) from None

    def _get_alive_model(self, customer_id: int) -> CustomerModel:
        model = self._db.scalar(self._alive().where(CustomerModel.id == customer_id))
        if model is None:
            raise NotFoundError("Cliente não encontrado")
        return model

    def get_by_id(self, customer_id: int) -> Customer | None:
        model = self._db.scalar(self._alive().where(CustomerModel.id == customer_id))
        return self._to_entity(model) if model else None

    def document_exists(self, document: str, *, exclude_id: int | None = None) -> bool:
        stmt = (
            select(func.count())
            .select_from(CustomerModel)
            .where(CustomerModel.deleted_at.is_(None), CustomerModel.document == document)
        )
        if exclude_id is not None:
            stmt = stmt.where(CustomerModel.id != exclude_id)
        return bool(self._db.scalar(stmt))

    def add(self, customer: Customer) -> Customer:
        if self.document_exists(customer.document):
            raise ConflictError(_DUPLICATE)
        model = CustomerModel(
            name=customer.name,
            document=customer.document,
            phone=customer.phone,
            email=customer.email,
            notes=customer.notes,
            created_by_id=customer.created_by_id,
            updated_by_id=customer.updated_by_id,
        )
        self._db.add(model)
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def update(self, customer: Customer) -> Customer:
        model = self._get_alive_model(customer.id)
        if self.document_exists(customer.document, exclude_id=customer.id):
            raise ConflictError(_DUPLICATE)
        model.name = customer.name
        model.document = customer.document
        model.phone = customer.phone
        model.email = customer.email
        model.notes = customer.notes
        model.updated_by_id = customer.updated_by_id
        self._commit()
        self._db.refresh(model)
        return self._to_entity(model)

    def soft_delete(self, customer_id: int) -> None:
        model = self._get_alive_model(customer_id)
        model.deleted_at = datetime.now(UTC).replace(tzinfo=None)
        self._db.commit()

    def has_vehicles(self, customer_id: int) -> bool:
        # Ligado na B2 (tabela vehicles ainda não existe).
        return False

    def list_page(
        self, *, offset: int, limit: int, search: str | None
    ) -> tuple[list[Customer], int]:
        stmt = self._alive()
        if search and search.strip():
            term = search.strip()
            like = f"%{_escape(term)}%"
            # Busca mascarada ("529.982.247-25", "(11) 9888") casa com os dígitos armazenados.
            digits = normalize_digits(term) if _MASKED_NUMBER.fullmatch(term) else term
            digits_like = f"%{_escape(digits)}%"
            stmt = stmt.where(
                or_(
                    CustomerModel.name.ilike(like, escape="\\"),
                    CustomerModel.document.ilike(digits_like, escape="\\"),
                    CustomerModel.phone.ilike(digits_like, escape="\\"),
                    CustomerModel.email.ilike(like, escape="\\"),
                )
            )
        total = self._db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self._db.scalars(
            stmt.order_by(CustomerModel.id).offset(offset).limit(limit)
        ).all()
        return [self._to_entity(r) for r in rows], total

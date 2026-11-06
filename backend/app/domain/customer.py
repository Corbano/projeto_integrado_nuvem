from dataclasses import dataclass
from typing import Protocol


@dataclass
class Customer:
    id: int | None
    name: str
    document: str
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    created_by_id: int | None = None
    updated_by_id: int | None = None


class CustomerRepository(Protocol):
    def get_by_id(self, customer_id: int) -> Customer | None: ...

    def document_exists(self, document: str, *, exclude_id: int | None = None) -> bool:
        """Considera apenas clientes não excluídos."""
        ...

    def add(self, customer: Customer) -> Customer: ...

    def update(self, customer: Customer) -> Customer: ...

    def soft_delete(self, customer_id: int) -> None: ...

    def has_vehicles(self, customer_id: int) -> bool:
        """Verdadeiro se o cliente tem veículos ativos (ligado na B2)."""
        ...

    def list_page(
        self, *, offset: int, limit: int, search: str | None
    ) -> tuple[list[Customer], int]: ...

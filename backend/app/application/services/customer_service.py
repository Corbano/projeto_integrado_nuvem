from app.application.dtos.common import Page
from app.application.dtos.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.domain.customer import Customer, CustomerRepository
from app.domain.errors import BusinessRuleError, ConflictError, NotFoundError


class CustomerService:
    def __init__(self, customers: CustomerRepository) -> None:
        self._customers = customers

    def create(self, data: CustomerCreate, *, actor_id: int) -> CustomerOut:
        if self._customers.document_exists(data.document):
            raise ConflictError("Já existe um cliente com este CPF/CNPJ")
        saved = self._customers.add(
            Customer(
                id=None,
                name=data.name,
                document=data.document,
                phone=data.phone,
                email=data.email,
                notes=data.notes,
                created_by_id=actor_id,
                updated_by_id=actor_id,
            )
        )
        return CustomerOut.from_entity(saved)

    def get(self, customer_id: int) -> CustomerOut:
        return CustomerOut.from_entity(self._get_or_404(customer_id))

    def list_customers(
        self, *, page: int, size: int, search: str | None
    ) -> Page[CustomerOut]:
        customers, total = self._customers.list_page(
            offset=(page - 1) * size, limit=size, search=search
        )
        return Page[CustomerOut](
            items=[CustomerOut.from_entity(c) for c in customers],
            total=total,
            page=page,
            size=size,
        )

    def update(self, customer_id: int, data: CustomerUpdate, *, actor_id: int) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        changes = data.model_dump(exclude_unset=True)
        if "document" in changes and self._customers.document_exists(
            changes["document"], exclude_id=customer_id
        ):
            raise ConflictError("Já existe um cliente com este CPF/CNPJ")
        for field, value in changes.items():
            setattr(customer, field, value)
        customer.updated_by_id = actor_id
        return CustomerOut.from_entity(self._customers.update(customer))

    def delete(self, customer_id: int) -> None:
        self._get_or_404(customer_id)
        if self._customers.has_vehicles(customer_id):
            raise BusinessRuleError("Cliente possui veículos cadastrados")
        self._customers.soft_delete(customer_id)

    def _get_or_404(self, customer_id: int) -> Customer:
        customer = self._customers.get_by_id(customer_id)
        if customer is None:
            raise NotFoundError("Cliente não encontrado")
        return customer

from app.application.dtos.common import Page
from app.application.dtos.vehicle import (
    CustomerSummary,
    VehicleCreate,
    VehicleDetailOut,
    VehicleOut,
    VehicleUpdate,
)
from app.domain.customer import Customer, CustomerRepository
from app.domain.errors import ConflictError, NotFoundError
from app.domain.vehicle import Vehicle, VehicleRepository

_PLATE_TAKEN = "Placa já cadastrada"
_CHASSIS_TAKEN = "Chassi já cadastrado"


class VehicleService:
    def __init__(self, vehicles: VehicleRepository, customers: CustomerRepository) -> None:
        self._vehicles = vehicles
        self._customers = customers

    def create(self, data: VehicleCreate, *, actor_id: int) -> VehicleOut:
        self._active_customer_or_404(data.customer_id)
        if self._vehicles.plate_exists(data.plate):
            raise ConflictError(_PLATE_TAKEN)
        if data.chassis and self._vehicles.chassis_exists(data.chassis):
            raise ConflictError(_CHASSIS_TAKEN)
        saved = self._vehicles.add(
            Vehicle(
                id=None,
                customer_id=data.customer_id,
                plate=data.plate,
                brand=data.brand,
                model=data.model,
                year=data.year,
                fuel=data.fuel,
                color=data.color,
                engine=data.engine,
                chassis=data.chassis,
                renavam=data.renavam,
                current_km=0,
                created_by_id=actor_id,
                updated_by_id=actor_id,
            )
        )
        return VehicleOut.from_entity(saved)

    def get(self, vehicle_id: int) -> VehicleDetailOut:
        vehicle = self._get_or_404(vehicle_id)
        customer = self._customers.get_by_id(vehicle.customer_id)
        summary = CustomerSummary(id=customer.id, name=customer.name) if customer else None
        return VehicleDetailOut.from_entity(vehicle, summary)

    def list_vehicles(
        self, *, page: int, size: int, search: str | None, customer_id: int | None = None
    ) -> Page[VehicleOut]:
        vehicles, total = self._vehicles.list_page(
            offset=(page - 1) * size, limit=size, search=search, customer_id=customer_id
        )
        return Page[VehicleOut](
            items=[VehicleOut.from_entity(v) for v in vehicles],
            total=total,
            page=page,
            size=size,
        )

    def list_by_customer(
        self, customer_id: int, *, page: int, size: int, search: str | None = None
    ) -> Page[VehicleOut]:
        self._active_customer_or_404(customer_id)
        return self.list_vehicles(page=page, size=size, search=search, customer_id=customer_id)

    def update(self, vehicle_id: int, data: VehicleUpdate, *, actor_id: int) -> VehicleOut:
        vehicle = self._get_or_404(vehicle_id)
        changes = data.model_dump(exclude_unset=True)
        if "customer_id" in changes and changes["customer_id"] != vehicle.customer_id:
            self._active_customer_or_404(changes["customer_id"])
        if "plate" in changes and self._vehicles.plate_exists(
            changes["plate"], exclude_id=vehicle_id
        ):
            raise ConflictError(_PLATE_TAKEN)
        if changes.get("chassis") and self._vehicles.chassis_exists(
            changes["chassis"], exclude_id=vehicle_id
        ):
            raise ConflictError(_CHASSIS_TAKEN)
        for field, value in changes.items():
            setattr(vehicle, field, value)
        vehicle.updated_by_id = actor_id
        return VehicleOut.from_entity(self._vehicles.update(vehicle))

    def delete(self, vehicle_id: int, *, actor_id: int) -> None:
        self._get_or_404(vehicle_id)
        self._vehicles.soft_delete(vehicle_id, actor_id=actor_id)

    def _get_or_404(self, vehicle_id: int) -> Vehicle:
        vehicle = self._vehicles.get_by_id(vehicle_id)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado")
        return vehicle

    def _active_customer_or_404(self, customer_id: int) -> Customer:
        customer = self._customers.get_by_id(customer_id)
        if customer is None:
            raise NotFoundError("Cliente não encontrado")
        return customer

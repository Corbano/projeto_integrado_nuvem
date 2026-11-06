"""Dados de demonstração FICTÍCIOS (apenas dados e geradores; sem acesso a banco).

Nomes, empresas, documentos, placas e chassis são inventados/aleatórios (semente fixa, portanto
determinísticos). CPF/CNPJ têm dígitos verificadores válidos, mas não pertencem a ninguém de
propósito. E-mails usam o domínio reservado `example.com`.
"""

import random
from dataclasses import dataclass, field

from app.domain.vehicle import Fuel

_SEED = 20261106
_PLATE_LETTERS = "ABCDEFGHJKLMNPRSTUVWXZ"
_VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"  # sem I, O e Q


@dataclass(frozen=True)
class CustomerSeed:
    name: str
    document: str
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


@dataclass(frozen=True)
class KmReadingSeed:
    days_ago: int
    km: int


@dataclass(frozen=True)
class VehicleSeed:
    owner_document: str
    plate: str
    brand: str
    model: str
    year: int
    fuel: Fuel
    color: str
    engine: str | None
    chassis: str
    renavam: str | None
    readings: list[KmReadingSeed] = field(default_factory=list)


def _digit(digits: list[int], weights: list[int]) -> int:
    rest = sum(d * w for d, w in zip(digits, weights, strict=True)) % 11
    return 0 if rest < 2 else 11 - rest


def make_cpf(base: int) -> str:
    """CPF válido a partir de um número de 9 dígitos (evita sequências repetidas)."""
    digits = [int(c) for c in f"{base % 10**9:09d}"]
    if len(set(digits)) == 1:
        digits[-1] = (digits[-1] + 1) % 10
    digits.append(_digit(digits, list(range(10, 1, -1))))
    digits.append(_digit(digits, list(range(11, 1, -1))))
    return "".join(map(str, digits))


def make_cnpj(base: int) -> str:
    """CNPJ válido a partir de um número de 8 dígitos + filial 0001."""
    digits = [int(c) for c in f"{base % 10**8:08d}0001"]
    digits.append(_digit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
    digits.append(_digit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
    return "".join(map(str, digits))


# (nome, base do documento, telefone, e-mail, observações)
_PEOPLE: list[tuple[str, int, str | None, str | None, str | None]] = [
    ("Marcos Vinícius Almeida", 214365871, "11987650012", "marcos.almeida@example.com", None),
    ("Patrícia Souza Lima", 318452769, "11976540023", "patricia.lima@example.com",
     "Prefere contato por WhatsApp."),
    ("Roberto Carlos Nogueira", 427589631, None, None, None),
    ("Fernanda Oliveira Castro", 536721498, "11965430034", "fernanda.castro@example.com", None),
    ("José Augusto Ferreira", 645832157, "11954320045", None, "Cliente antigo, revisões anuais."),
    ("Luciana Barbosa Rocha", 754913286, "11943210056", "luciana.rocha@example.com", None),
    ("Anderson Pereira Dias", 863024915, "11932100067", None, None),
    ("Camila Ribeiro Martins", 972135644, "11921090078", "camila.martins@example.com",
     "Frota pessoal: dois veículos."),
    ("Thiago Mendes Carvalho", 183246573, None, "thiago.carvalho@example.com", None),
    ("Renata Gomes Teixeira", 294357682, "11910980089", "renata.teixeira@example.com", None),
    ("Eduardo Pires Moreira", 305468791, "11909870090", None, "Pagamento sempre à vista."),
]

_COMPANIES: list[tuple[str, int, str | None, str | None, str | None]] = [
    ("Transportes Boa Viagem Ltda", 12345601, "1133445566", "contato@boaviagem.example.com",
     "Frota de utilitários; faturamento mensal."),
    ("Padaria Pão Quente ME", 23456702, "11988776655", "padaria@paoquente.example.com", None),
    ("Construtora Alicerce Forte S/A", 34567803, "1134567890", "frota@alicerce.example.com",
     "Picapes para obras."),
    ("Mercadinho Estrela do Bairro Ltda", 45678904, "11977665544", None, None),
    ("Clínica Vida Plena Serviços Médicos", 56789005, "1135678901",
     "administrativo@vidaplena.example.com", None),
    ("Entregas Rápidas Moto e Cia Ltda", 67890106, "11966554433",
     "operacao@entregasrapidas.example.com", "Contrato de revisão trimestral."),
    ("Escritório Contábil Números Certos", 78901207, None, "contato@numeroscertos.example.com",
     None),
]

# (marca, modelo, ano, combustível, cor, motor)
_Car = tuple[str, str, int, Fuel, str, str | None]
_CARS: list[_Car] = [
    ("Fiat", "Uno Way", 2016, Fuel.FLEX, "Branco", "1.0 Fire Flex"),
    ("Fiat", "Argo Drive", 2021, Fuel.FLEX, "Vermelho", "1.3 Firefly"),
    ("Fiat", "Strada Freedom", 2022, Fuel.FLEX, "Prata", "1.3 Firefly"),
    ("Volkswagen", "Gol Trendline", 2015, Fuel.FLEX, "Prata", "1.0 EA111"),
    ("Volkswagen", "Polo Track", 2023, Fuel.FLEX, "Cinza", "1.0 MPI"),
    ("Volkswagen", "T-Cross Comfortline", 2022, Fuel.FLEX, "Branco", "1.0 TSI"),
    ("Chevrolet", "Onix LT", 2019, Fuel.FLEX, "Preto", "1.0 SPE/4"),
    ("Chevrolet", "Tracker Premier", 2021, Fuel.FLEX, "Azul", "1.2 Turbo"),
    ("Chevrolet", "S10 LTZ", 2020, Fuel.DIESEL, "Branco", "2.8 Duramax"),
    ("Hyundai", "HB20 Comfort", 2018, Fuel.FLEX, "Prata", "1.0 Kappa"),
    ("Hyundai", "Creta Pulse", 2023, Fuel.FLEX, "Cinza", "1.0 Turbo"),
    ("Toyota", "Corolla XEi", 2020, Fuel.FLEX, "Preto", "2.0 Dynamic Force"),
    ("Toyota", "Hilux SRV", 2021, Fuel.DIESEL, "Branco", "2.8 Turbo Diesel"),
    ("Honda", "Civic Sport", 2017, Fuel.FLEX, "Cinza", "2.0 i-VTEC"),
    ("Honda", "Fit EX", 2014, Fuel.FLEX, "Vermelho", "1.5 i-VTEC"),
    ("Renault", "Kwid Zen", 2022, Fuel.FLEX, "Laranja", "1.0 SCe"),
    ("Renault", "Duster Iconic", 2019, Fuel.FLEX, "Marrom", "1.6 SCe"),
    ("Jeep", "Compass Longitude", 2022, Fuel.FLEX, "Preto", "1.3 Turbo"),
    ("Ford", "Ka SE", 2017, Fuel.FLEX, "Branco", "1.0 Ti-VCT"),
    ("Ford", "Ranger XLS", 2018, Fuel.DIESEL, "Prata", "3.2 Duratorq"),
    ("Fiat", "Toro Endurance", 2021, Fuel.DIESEL, "Cinza", "2.0 Turbo Diesel"),
    ("Fiat", "Mobi Like", 2020, Fuel.FLEX, "Amarelo", "1.0 Fire"),
    ("Volkswagen", "Saveiro Robust", 2018, Fuel.FLEX, "Branco", "1.6 MSI"),
    ("Chevrolet", "Spin LTZ", 2019, Fuel.FLEX, "Prata", "1.8 Econo.Flex"),
    ("Hyundai", "HB20S Vision", 2020, Fuel.FLEX, "Azul", "1.6 Flex"),
    ("Toyota", "Yaris XL", 2021, Fuel.FLEX, "Vermelho", "1.3 Dual VVT-i"),
    ("Nissan", "Kicks Advance", 2021, Fuel.FLEX, "Branco", "1.6 16V"),
    ("Honda", "HR-V EXL", 2019, Fuel.FLEX, "Prata", "1.8 i-VTEC"),
]

# Índice do cliente dono de cada veículo de _CARS (28 itens). Alguns clientes têm 2-3.
_OWNERS = [0, 1, 2, 3, 4, 5, 7, 7, 12, 6, 8, 9, 13, 10, 11, 14, 15, 16, 17, 12,
           13, 14, 12, 15, 1, 3, 16, 0]


def build_customers() -> list[CustomerSeed]:
    customers = [
        CustomerSeed(name, make_cpf(base), phone, email, notes)
        for name, base, phone, email, notes in _PEOPLE
    ]
    customers += [
        CustomerSeed(name, make_cnpj(base), phone, email, notes)
        for name, base, phone, email, notes in _COMPANIES
    ]
    return customers


def _plate(rng: random.Random, mercosul: bool) -> str:
    letters = "".join(rng.choice(_PLATE_LETTERS) for _ in range(3))
    if mercosul:
        return f"{letters}{rng.randrange(10)}{rng.choice(_PLATE_LETTERS)}{rng.randrange(100):02d}"
    return f"{letters}{rng.randrange(10000):04d}"


def _readings(rng: random.Random, year: int, current_year: int) -> list[KmReadingSeed]:
    """1 a 3 leituras com km crescente e datas cada vez mais recentes."""
    final = max(1_500, int((current_year - year + 1) * rng.randint(8_000, 16_000)))
    final = round(final, -1)
    count = rng.randint(1, 3)
    km = final
    readings = [KmReadingSeed(days_ago=rng.randint(3, 40), km=km)]
    days = readings[0].days_ago
    for _ in range(count - 1):
        km = max(100, km - rng.randint(1_500, 6_000))
        days += rng.randint(60, 200)
        readings.append(KmReadingSeed(days_ago=days, km=round(km, -1)))
    readings.reverse()  # mais antiga primeiro
    # garante estritamente crescente
    fixed: list[KmReadingSeed] = []
    for r in readings:
        if fixed and r.km <= fixed[-1].km:
            r = KmReadingSeed(days_ago=r.days_ago, km=fixed[-1].km + 250)
        fixed.append(r)
    return fixed


def build_vehicles(current_year: int = 2026) -> list[VehicleSeed]:
    rng = random.Random(_SEED)
    customers = build_customers()
    vehicles: list[VehicleSeed] = []
    plates: set[str] = set()
    chassis_set: set[str] = set()
    for index, (car, owner) in enumerate(zip(_CARS, _OWNERS, strict=True)):
        brand, model, year, fuel, color, engine = car
        mercosul = year >= 2019 or index % 5 == 0
        plate = _plate(rng, mercosul)
        while plate in plates:
            plate = _plate(rng, mercosul)
        plates.add(plate)
        vin = "".join(rng.choice(_VIN_CHARS) for _ in range(17))
        while vin in chassis_set:
            vin = "".join(rng.choice(_VIN_CHARS) for _ in range(17))
        chassis_set.add(vin)
        renavam = "".join(str(rng.randrange(10)) for _ in range(11)) if index % 2 == 0 else None
        vehicles.append(
            VehicleSeed(
                owner_document=customers[owner].document,
                plate=plate,
                brand=brand,
                model=model,
                year=year,
                fuel=fuel,
                color=color,
                engine=engine,
                chassis=vin,
                renavam=renavam,
                readings=_readings(rng, year, current_year),
            )
        )
    return vehicles

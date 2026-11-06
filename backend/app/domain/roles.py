from enum import Enum


class Role(str, Enum):  # noqa: UP042
    ADMIN = "admin"
    RECEPTION = "reception"
    MECHANIC = "mechanic"

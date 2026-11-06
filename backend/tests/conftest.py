import os

# Deve rodar antes de qualquer import de `app` (as Settings são cacheadas).
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("BCRYPT_ROUNDS", "4")

import os

# Deve rodar antes de qualquer import de `app` (as Settings são cacheadas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"

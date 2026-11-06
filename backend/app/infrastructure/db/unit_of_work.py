from sqlalchemy.orm import Session


class SqlUnitOfWork:
    """Fronteira de transação sobre a sessão compartilhada pelos repositórios."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

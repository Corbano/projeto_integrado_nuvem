"""customers.active_document: unicidade de documento entre ativos

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("customers") as batch:
        batch.add_column(sa.Column("active_document", sa.String(14), nullable=True))
    # Se já existirem documentos duplicados entre ativos, a criação do índice único
    # abaixo falha de propósito: resolva as duplicidades manualmente e rode de novo.
    op.execute("UPDATE customers SET active_document = document WHERE deleted_at IS NULL")
    op.create_index(
        "ix_customers_active_document", "customers", ["active_document"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_customers_active_document", table_name="customers")
    with op.batch_alter_table("customers") as batch:
        batch.drop_column("active_document")

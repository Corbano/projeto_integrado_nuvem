"""create vehicles

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("plate", sa.String(7), nullable=False),
        sa.Column("active_plate", sa.String(7), nullable=True),
        sa.Column("brand", sa.String(60), nullable=False),
        sa.Column("model", sa.String(60), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("engine", sa.String(60), nullable=True),
        sa.Column("fuel", sa.String(16), nullable=False),
        sa.Column("color", sa.String(40), nullable=False),
        sa.Column("chassis", sa.String(17), nullable=True),
        sa.Column("active_chassis", sa.String(17), nullable=True),
        sa.Column("renavam", sa.String(11), nullable=True),
        sa.Column("current_km", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_vehicles_customer_id", "vehicles", ["customer_id"])
    op.create_index("ix_vehicles_plate", "vehicles", ["plate"])
    op.create_index("ix_vehicles_active_plate", "vehicles", ["active_plate"], unique=True)
    op.create_index("ix_vehicles_active_chassis", "vehicles", ["active_chassis"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_vehicles_active_chassis", table_name="vehicles")
    op.drop_index("ix_vehicles_active_plate", table_name="vehicles")
    op.drop_index("ix_vehicles_plate", table_name="vehicles")
    op.drop_index("ix_vehicles_customer_id", table_name="vehicles")
    op.drop_table("vehicles")

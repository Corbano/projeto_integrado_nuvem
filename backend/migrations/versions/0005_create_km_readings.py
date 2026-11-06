"""create km_readings

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "km_readings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("km", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("recorded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("km >= 0 AND km <= 5000000", name="ck_km_readings_km_range"),
    )
    op.create_index(
        "ix_km_readings_vehicle_id_created_at", "km_readings", ["vehicle_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_km_readings_vehicle_id_created_at", table_name="km_readings")
    op.drop_table("km_readings")

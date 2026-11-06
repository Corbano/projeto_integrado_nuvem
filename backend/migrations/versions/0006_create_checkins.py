"""create checkins, checkin_checklist_items and checkin_photos

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "checkins",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("km", sa.Integer(), nullable=False),
        sa.Column("fuel_level", sa.String(16), nullable=False),
        sa.Column("damages", sa.Text(), nullable=True),
        sa.Column("accessories", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.CheckConstraint("km >= 0 AND km <= 5000000", name="ck_checkins_km_range"),
    )
    op.create_index("ix_checkins_vehicle_id_created_at", "checkins", ["vehicle_id", "created_at"])
    op.create_table(
        "checkin_checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("checkin_id", sa.Integer(), sa.ForeignKey("checkins.id"), nullable=False),
        sa.Column("item", sa.String(20), nullable=False),
        sa.Column("condition", sa.String(10), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.UniqueConstraint(
            "checkin_id", "item", name="uq_checkin_checklist_items_checkin_item"
        ),
    )
    op.create_table(
        "checkin_photos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("checkin_id", sa.Integer(), sa.ForeignKey("checkins.id"), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
        sa.Column("content_type", sa.String(32), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_checkin_photos_checkin_id", "checkin_photos", ["checkin_id"])


def downgrade() -> None:
    op.drop_index("ix_checkin_photos_checkin_id", table_name="checkin_photos")
    op.drop_table("checkin_photos")
    op.drop_table("checkin_checklist_items")
    op.drop_index("ix_checkins_vehicle_id_created_at", table_name="checkins")
    op.drop_table("checkins")

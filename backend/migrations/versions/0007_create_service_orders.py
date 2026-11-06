"""create service_orders, service_order_items and service_order_status_history

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "service_orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("checkin_id", sa.Integer(), sa.ForeignKey("checkins.id"), nullable=True),
        sa.Column("mechanic_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reported_issue", sa.Text(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("labor_cost", sa.Numeric(10, 2), nullable=False),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("labor_cost >= 0", name="ck_service_orders_labor_cost"),
        sa.CheckConstraint("total >= 0", name="ck_service_orders_total"),
    )
    op.create_index("ix_service_orders_number", "service_orders", ["number"], unique=True)
    op.create_index("ix_service_orders_vehicle_id", "service_orders", ["vehicle_id"])
    op.create_index("ix_service_orders_mechanic_id", "service_orders", ["mechanic_id"])
    op.create_index("ix_service_orders_status", "service_orders", ["status"])
    op.create_table(
        "service_order_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "service_order_id", sa.Integer(), sa.ForeignKey("service_orders.id"), nullable=False
        ),
        sa.Column("kind", sa.String(8), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("qty", sa.Numeric(10, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("rule_code", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("qty > 0", name="ck_service_order_items_qty"),
        sa.CheckConstraint("unit_price >= 0", name="ck_service_order_items_unit_price"),
    )
    op.create_index(
        "ix_service_order_items_service_order_id", "service_order_items", ["service_order_id"]
    )
    op.create_table(
        "service_order_status_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "service_order_id", sa.Integer(), sa.ForeignKey("service_orders.id"), nullable=False
        ),
        sa.Column("from_status", sa.String(24), nullable=True),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("changed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_service_order_status_history_order_id",
        "service_order_status_history",
        ["service_order_id", "changed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_service_order_status_history_order_id", table_name="service_order_status_history"
    )
    op.drop_table("service_order_status_history")
    op.drop_index("ix_service_order_items_service_order_id", table_name="service_order_items")
    op.drop_table("service_order_items")
    op.drop_index("ix_service_orders_status", table_name="service_orders")
    op.drop_index("ix_service_orders_mechanic_id", table_name="service_orders")
    op.drop_index("ix_service_orders_vehicle_id", table_name="service_orders")
    op.drop_index("ix_service_orders_number", table_name="service_orders")
    op.drop_table("service_orders")

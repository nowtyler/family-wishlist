"""Add notifications table

Revision ID: 003_add_notifications
Revises: 002_add_shopping_cart_items
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003_add_notifications"
down_revision = "002_add_shopping_cart_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("family_members.id"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("cart_item_id", sa.Integer(), sa.ForeignKey("shopping_cart_items.id"), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"], unique=False)
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_id", table_name="notifications")
    op.drop_index("ix_notifications_id", table_name="notifications")
    op.drop_table("notifications")

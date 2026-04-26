"""Add recipient_name to shopping cart items

Revision ID: 004_add_recipient_name_to_shopping_cart
Revises: 003_add_notifications
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "004_add_recipient_name_to_shopping_cart"
down_revision = "003_add_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("shopping_cart_items") as batch_op:
        batch_op.add_column(sa.Column("recipient_name", sa.String(), nullable=True))
        batch_op.alter_column("recipient_id", nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("shopping_cart_items") as batch_op:
        batch_op.alter_column("recipient_id", nullable=False)
        batch_op.drop_column("recipient_name")

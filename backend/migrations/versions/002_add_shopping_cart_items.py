"""Add shopping_cart_items table

Revision ID: 002_add_shopping_cart_items
Revises: None
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "002_add_shopping_cart_items"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shopping_cart_items",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("family_members.id"), nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("family_members.id"), nullable=False),
        sa.Column("wishlist_item_id", sa.Integer(), sa.ForeignKey("wishlist_items.id"), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("purchased_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_shopping_cart_items_id", "shopping_cart_items", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_shopping_cart_items_id", table_name="shopping_cart_items")
    op.drop_table("shopping_cart_items")

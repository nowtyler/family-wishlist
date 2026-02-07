"""Add shared wishlist support to shopping cart and comments

Revision ID: 008_add_shared_wishlist_support_to_cart_and_comments
Revises: 007_add_occasion_fields_to_shared_wishlists
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "008_add_shared_wishlist_support_to_cart_and_comments"
down_revision = "007_add_occasion_fields_to_shared_wishlists"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def index_exists(table_name, index_name):
    """Check if an index exists on a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    indexes = [idx['name'] for idx in inspector.get_indexes(table_name)]
    return index_name in indexes


def upgrade() -> None:
    # Add shared_wishlist_item_id to shopping_cart_items (without FK constraint for SQLite)
    if not column_exists("shopping_cart_items", "shared_wishlist_item_id"):
        op.add_column(
            "shopping_cart_items",
            sa.Column("shared_wishlist_item_id", sa.Integer(), nullable=True)
        )

    if not index_exists("shopping_cart_items", "ix_shopping_cart_items_shared_wishlist_item_id"):
        op.create_index(
            "ix_shopping_cart_items_shared_wishlist_item_id",
            "shopping_cart_items",
            ["shared_wishlist_item_id"],
            unique=False
        )

    # Add shared_item_id to comments table (without FK constraint for SQLite)
    if not column_exists("comments", "shared_item_id"):
        op.add_column(
            "comments",
            sa.Column("shared_item_id", sa.Integer(), nullable=True)
        )

    if not index_exists("comments", "ix_comments_shared_item_id"):
        op.create_index(
            "ix_comments_shared_item_id",
            "comments",
            ["shared_item_id"],
            unique=False
        )


def downgrade() -> None:
    # Remove shared_item_id from comments
    op.drop_index("ix_comments_shared_item_id", table_name="comments")
    op.drop_column("comments", "shared_item_id")

    # Remove shared_wishlist_item_id from shopping_cart_items
    op.drop_index("ix_shopping_cart_items_shared_wishlist_item_id", table_name="shopping_cart_items")
    op.drop_column("shopping_cart_items", "shared_wishlist_item_id")

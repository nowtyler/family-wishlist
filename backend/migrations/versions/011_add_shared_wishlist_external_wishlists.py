"""Add shared_wishlist_id to external_wishlists for shared wishlist support

Revision ID: 011_add_shared_wishlist_external_wishlists
Revises: 010_migrate_purchased_items_to_carts
Create Date: 2026-03-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "011_add_shared_wishlist_external_wishlists"
down_revision = "010_migrate_purchased_items_to_carts"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    needs_new_column = not column_exists("external_wishlists", "shared_wishlist_id")

    with op.batch_alter_table("external_wishlists") as batch_op:
        if needs_new_column:
            batch_op.add_column(
                sa.Column("shared_wishlist_id", sa.Integer(), sa.ForeignKey("shared_wishlists.id"), nullable=True)
            )
        # Make owner_id nullable so shared wishlist external wishlists don't need an owner
        batch_op.alter_column("owner_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("external_wishlists") as batch_op:
        batch_op.alter_column("owner_id", existing_type=sa.Integer(), nullable=False)
        if column_exists("external_wishlists", "shared_wishlist_id"):
            batch_op.drop_column("shared_wishlist_id")

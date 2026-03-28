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


def foreign_key_exists(table_name, constraint_name):
    """Check if a foreign key constraint exists on a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    foreign_keys = inspector.get_foreign_keys(table_name)
    return any(fk.get("name") == constraint_name for fk in foreign_keys)


def upgrade() -> None:
    needs_new_column = not column_exists("external_wishlists", "shared_wishlist_id")
    needs_new_fk = not foreign_key_exists(
        "external_wishlists", "fk_external_wishlists_shared_wishlist_id"
    )

    with op.batch_alter_table("external_wishlists") as batch_op:
        if needs_new_column:
            batch_op.add_column(sa.Column("shared_wishlist_id", sa.Integer(), nullable=True))
        if needs_new_fk:
            batch_op.create_foreign_key(
                "fk_external_wishlists_shared_wishlist_id",
                "shared_wishlists",
                ["shared_wishlist_id"],
                ["id"],
            )
        # Make owner_id nullable so shared wishlist external wishlists don't need an owner
        batch_op.alter_column("owner_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Shared-wishlist-only external wishlists cannot survive the rollback because
    # pre-011 schema requires owner_id to be non-null and has no shared_wishlist_id.
    op.execute(
        sa.text("DELETE FROM external_wishlists WHERE owner_id IS NULL")
    )

    with op.batch_alter_table("external_wishlists") as batch_op:
        batch_op.alter_column("owner_id", existing_type=sa.Integer(), nullable=False)
        if foreign_key_exists("external_wishlists", "fk_external_wishlists_shared_wishlist_id"):
            batch_op.drop_constraint(
                "fk_external_wishlists_shared_wishlist_id", type_="foreignkey"
            )
        if column_exists("external_wishlists", "shared_wishlist_id"):
            batch_op.drop_column("shared_wishlist_id")
